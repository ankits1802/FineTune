'use client';

import type { MusicRNN, SoundFontPlayer, INoteSequence } from '@magenta/music/es6';
import { getMusicIdeasFromText, type GetMusicIdeasFromTextOutput } from '@/ai/flows/music-generation-from-text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, Download, ListMusic, Moon, Music, Pause, Play, Repeat, Share2, Shuffle, SkipBack, SkipForward, Sparkles, Sun, Trash2 } from 'lucide-react';
import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import * as Tone from 'tone';
import { z } from 'zod';

const formSchema = z.object({
  seedText: z.string().min(10, {
    message: "Please enter at least 10 characters for a more unique track.",
  }),
});

type HistoryItem = {
  seedText: string;
  hashValue: string;
  timestamp: number;
};

const instruments = [
  { name: 'Piano', program: 0 },
  { name: 'Electric Piano', program: 4 },
  { name: 'Harpsichord', program: 6 },
  { name: 'Music Box', program: 10 },
  { name: 'Marimba', program: 12 },
  { name: 'Acoustic Guitar (Nylon)', program: 24 },
  { name: 'Electric Guitar (Clean)', program: 27 },
  { name: 'Acoustic Bass', program: 32 },
  { name: 'Violin', program: 40 },
  { name: 'Cello', program: 42 },
  { name: 'Trumpet', program: 56 },
  { name: 'Tenor Sax', program: 66 },
  { name: 'Flute', program: 73 },
  { name: 'Synth Pad (Warm)', program: 89 },
  { name: 'Synth Lead (Square)', program: 80 },
];

export default function HashNotesPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [generatedIdeas, setGeneratedIdeas] = useState<GetMusicIdeasFromTextOutput | null>(null);
  const [generatedSequence, setGeneratedSequence] = useState<INoteSequence | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [playbackState, setPlaybackState] = useState({ isPlaying: false, progress: 0, tempo: 120, volume: 80 });
  const [selectedProgram, setSelectedProgram] = useState(0);
  const [theme, setTheme] = useState('dark');
  const [isSeeking, setIsSeeking] = useState(false);

  const musicLibRef = useRef<any>(null);
  const musicRnnRef = useRef<MusicRNN | null>(null);
  const playerRef = useRef<SoundFontPlayer | null>(null);
  
  const [isModelReady, setIsModelReady] = useState(false);

  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      seedText: '',
    },
  });

  useEffect(() => {
    const storedTheme = localStorage.getItem('hashnotes-theme') || 'dark';
    setTheme(storedTheme);
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('hashnotes-theme', theme);
  }, [theme]);
  
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('hashnotes-history');
      if (storedHistory) {
        setHistory(JSON.parse(storedHistory));
      }

      const hash = window.location.hash.slice(1);
      if (hash) {
        const decodedSeed = atob(hash);
        form.setValue('seedText', decodedSeed);
      } else {
        form.setValue('seedText', `A futuristic city skyline at dusk, neon lights reflecting on wet streets after a gentle rain.`);
      }
    } catch (error) {
      console.error("Failed to initialize from storage or URL:", error);
      form.setValue('seedText', `Timestamp: ${new Date().toISOString()}`);
    }
  }, [form]);

  const stableToast = useCallback(toast, []);

  useEffect(() => {
    const initMagenta = async () => {
      try {
        const mm = await import('@magenta/music/es6');
        musicLibRef.current = mm;

        const rnn = new mm.MusicRNN('https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn');
        await rnn.initialize();
        musicRnnRef.current = rnn;

        const sfPlayer = new mm.SoundFontPlayer(
          'https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus',
          undefined,
          undefined,
          undefined,
          {
            run: (note) => {},
            stop: async () => {
              setPlaybackState(ps => ({ ...ps, isPlaying: false, progress: 100 }));
            }
          }
        );
        
        await sfPlayer.loadSamples({notes: [{program: 0, pitch: 60, velocity: 80}]});
        playerRef.current = sfPlayer;
        
        setIsModelReady(true);
      } catch (err) {
        stableToast({ variant: 'destructive', title: 'Model Error', description: 'Could not load the music model.' });
        console.error(err);
      }
    };
    
    initMagenta();

    return () => {
      playerRef.current?.stop();
    };
  }, [stableToast]);
  
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (playbackState.isPlaying && !isSeeking && generatedSequence?.totalTime) {
      interval = setInterval(() => {
        const currentTime = Tone.Transport.seconds;
        const totalTime = generatedSequence.totalTime || 0;
        const progress = totalTime > 0 ? (currentTime / totalTime) * 100 : 0;
        
        setPlaybackState(p => ({
          ...p,
          progress: Math.max(0, Math.min(100, progress)),
        }));
      }, 100); 
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [playbackState.isPlaying, generatedSequence, isSeeking]);

  const updateHistory = (newItem: HistoryItem) => {
    const newHistory = [newItem, ...history.filter(item => item.hashValue !== newItem.hashValue)].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('hashnotes-history', JSON.stringify(newHistory));
  };

  const handleRestart = useCallback(() => {
    if (playerRef.current) {
      if (playerRef.current.isPlaying()) {
        playerRef.current.stop();
      }
      Tone.Transport.stop();
      Tone.Transport.position = 0;
      setPlaybackState(p => ({ ...p, isPlaying: false, progress: 0 }));
    }
  }, []);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setGeneratedIdeas(null);
    setGeneratedSequence(null);
    handleRestart();

    try {
      const ideas = await getMusicIdeasFromText({ inputText: values.seedText });
      setGeneratedIdeas(ideas);
      setPlaybackState(p => ({ ...p, tempo: ideas.tempo, progress: 0, isPlaying: false }));

      toast({
        title: "🎵 Ideas Generated!",
        description: `Style: ${ideas.style}. Now composing...`,
      });
      
      const musicRnn = musicRnnRef.current;
      const musicLib = musicLibRef.current;
      
      if (musicRnn && musicLib) {
        const seedNotes = [];
        const hash = ideas.hashValue;
        for (let i = 0; i < 4; i++) {
            const pitch = 60 + (parseInt(hash.substring(i * 2, i * 2 + 2), 16) % 24);
            seedNotes.push({
                pitch: pitch,
                startTime: i * 0.5,
                endTime: i * 0.5 + 0.5,
                velocity: 100,
            });
        }
        const seedSequence: INoteSequence = {
            ticksPerQuarter: 220,
            totalTime: seedNotes.length * 0.5,
            notes: seedNotes,
            tempos: [{ time: 0, qpm: ideas.tempo }]
        };
        
        const qns = musicLib.sequences.quantizeNoteSequence(seedSequence, 4);

        const temperature = 1.1;
        const sequence = await musicRnn.continueSequence(qns, 60, temperature);
        setGeneratedSequence(sequence);

        updateHistory({
          seedText: values.seedText,
          hashValue: ideas.hashValue,
          timestamp: Date.now(),
        });

        toast({
          title: "🎼 Track Ready!",
          description: "Your new composition is ready for playback.",
        });
      }
    } catch (error) {
      console.error("Error generating music:", error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: String(error) || "Could not generate music. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handlePlayPause = useCallback(async () => {
    const player = playerRef.current;
    const musicLib = musicLibRef.current;

    if (!player || !generatedSequence || !musicLib) return;
    
    await Tone.start();

    if (player.isPlaying()) {
      player.stop();
      Tone.Transport.pause();
      setPlaybackState(p => ({ ...p, isPlaying: false }));
    } else {
      const sequenceToPlay = musicLib.sequences.clone(generatedSequence);
      sequenceToPlay.notes.forEach((note: any) => {
        note.program = selectedProgram;
        note.velocity = Math.round((playbackState.volume / 100) * 127);
      });
      sequenceToPlay.tempos = [{ time: 0, qpm: playbackState.tempo }];
      
      try {
        const progress = playbackState.progress >= 100 ? 0 : playbackState.progress;
        const totalTime = generatedSequence.totalTime || 0;
        const offset = totalTime * (progress / 100);
        
        Tone.Transport.bpm.value = playbackState.tempo;
        
        if (Tone.Transport.state === 'paused') {
          Tone.Transport.start();
        } else {
          await player.start(sequenceToPlay, undefined, offset);
        }

        setPlaybackState(p => ({ ...p, isPlaying: true, progress: progress }));
      } catch (e) {
        console.error("Player start error:", e);
        toast({ variant: "destructive", title: "Playback Error", description: "Could not start music."})
      }
    }
  }, [generatedSequence, playbackState, selectedProgram, toast]);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({
      description: `${type} copied to clipboard!`,
    });
  };

  const handleShare = () => {
    if (generatedIdeas) {
      const encodedSeed = btoa(form.getValues('seedText'));
      const url = `${window.location.origin}${window.location.pathname}#${encodedSeed}`;
      handleCopy(url, 'Share link');
    }
  };

  const loadFromHistory = (item: HistoryItem) => {
    form.setValue('seedText', item.seedText);
    onSubmit({ seedText: item.seedText });
  };
  
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('hashnotes-history');
    toast({
      description: "History cleared.",
    });
  };

  const seekToProgress = useCallback(async (newProgress: number) => {
    if (!generatedSequence || !playerRef.current) return;
  
    const wasPlaying = playbackState.isPlaying;
    if (wasPlaying) {
      playerRef.current.stop();
      Tone.Transport.pause();
    }
  
    const clampedProgress = Math.max(0, Math.min(100, newProgress));
    const totalTime = generatedSequence.totalTime || 0;
    const seekTime = (totalTime * clampedProgress) / 100;
    
    setPlaybackState(p => ({ ...p, progress: clampedProgress, isPlaying: false }));
    Tone.Transport.seconds = seekTime;
  
    if (wasPlaying) {
      await new Promise(resolve => setTimeout(resolve, 50));
      handlePlayPause();
    }
  }, [generatedSequence, playbackState.isPlaying, handlePlayPause]);

  const handleProgressChange = (value: number[]) => {
    if (!generatedSequence) return;
    setIsSeeking(true);
    setPlaybackState(p => ({ ...p, progress: value[0] }));
  };
  
  const handleSeekCommit = (value: number[]) => {
    setIsSeeking(false);
    seekToProgress(value[0]);
  };

  const handleSeekBy = (seconds: number) => {
    if (!generatedSequence) return;
    const totalTime = generatedSequence.totalTime || 0;
    if (totalTime === 0) return;
    
    const currentProgress = playbackState.progress;
    const currentTime = (totalTime * currentProgress) / 100;
    const newTime = currentTime + seconds;
    const newProgress = (newTime / totalTime) * 100;
    seekToProgress(newProgress);
  };

  const handleDownload = async () => {
    if (!generatedSequence || !musicLibRef.current) {
      toast({
        variant: 'destructive',
        title: 'Download Error',
        description: 'No music sequence available to download.',
      });
      return;
    }
    
    try {
      // Ensure notes have velocity (required for MIDI conversion)
      const sequenceWithVelocity = { ...generatedSequence };
      sequenceWithVelocity.notes = generatedSequence.notes.map(note => ({
        ...note,
        velocity: note.velocity || 80 // Default velocity if not set
      }));

      // Access sequenceProtoToMidi directly from the imported module
      const midiData = musicLibRef.current.sequenceProtoToMidi(sequenceWithVelocity);
      const blob = new Blob([midiData], { type: 'audio/midi' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finetune-track-${Date.now()}.mid`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'MIDI download started!' });
    } catch (error) {
      console.error('MIDI download error:', error);
      toast({ 
        variant: 'destructive',
        title: 'Download Error', 
        description: 'Failed to download MIDI file. Please try again.' 
      });
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const totalTime = useMemo(() => generatedSequence?.totalTime || 0, [generatedSequence]);
  const currentTime = useMemo(() => {
    const total = totalTime || 0;
    return total > 0 ? (total * playbackState.progress) / 100 : 0;
  }, [totalTime, playbackState.progress]);

  const memoizedHistory = useMemo(() => (
    <Card className="bg-card/50 border-border/50 animate-fade-in-up animation-delay-400">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="font-headline flex items-center gap-2"><ListMusic className="w-5 h-5 text-primary" /> History</CardTitle>
          {history.length > 0 && <Button variant="ghost" size="icon" onClick={clearHistory}><Trash2 className="w-4 h-4" /></Button>}
        </div>
        <CardDescription>Recently generated tracks.</CardDescription>
      </CardHeader>
      <CardContent>
        {history.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {history.map(item => (
              <Button key={item.hashValue} variant="secondary" className="w-full justify-start h-auto text-left" onClick={() => loadFromHistory(item)}>
                <div>
                  <p className="font-semibold truncate text-sm">{item.seedText}</p>
                  <p className="text-xs text-muted-foreground font-mono">{item.hashValue.substring(0, 16)}...</p>
                </div>
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No recent tracks. Generate one to start!</p>
        )}
      </CardContent>
    </Card>
  ), [history, clearHistory, loadFromHistory]);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      
      <header className="fixed top-0 left-0 right-0 z-10 backdrop-blur-md bg-background/50 border-b">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between">
          <h1 className="font-headline text-2xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">FineTune</h1>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
      </header>
      
      <main className="container mx-auto px-4 sm:px-6 md:px-8 pt-28 pb-8 max-w-7xl">
        <div className="text-center mb-12 animate-fade-in-up">
          <p className="font-headline text-5xl md:text-6xl font-bold tracking-tighter">AI Music Generation</p>
          <p className="text-muted-foreground mt-2 text-lg max-w-2xl mx-auto">Turn your words, thoughts, and feelings into unique musical compositions with the power of AI.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-8">
            <Card className="shadow-lg transition-all duration-300 hover:shadow-primary/20 animate-fade-in-up animation-delay-200">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2 text-2xl">
                      <Sparkles className="w-6 h-6 text-primary" />
                      1. Describe Your Vibe
                    </CardTitle>
                    <CardDescription>Enter any text to generate a unique musical seed. Your words become notes.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="seedText"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              placeholder="e.g., a line from a poem, a random thought, or a special date..."
                              className="min-h-[150px] text-base resize-y bg-background"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" disabled={isLoading || !isModelReady} size="lg" className="w-full font-bold">
                      {isLoading ? "Fine-tuning..." : (isModelReady ? "Generate Music" : "Loading Models...")}
                    </Button>
                  </CardFooter>
                </form>
              </Form>
            </Card>

            <Card className={`transition-opacity duration-500 animate-fade-in-up animation-delay-400`}>
              <CardHeader>
                 <CardTitle className="font-headline flex items-center gap-2 text-2xl">
                    <Music className="w-6 h-6 text-accent" />
                    2. Player & Controls
                  </CardTitle>
                <CardDescription>Fine-tune, play, and download your masterpiece.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                
                {generatedIdeas && (
                  <div className="text-center mb-4">
                    <p className="text-lg font-bold tracking-tight">{generatedIdeas.style}</p>
                    <p className="text-sm text-muted-foreground">{generatedIdeas.key}</p>
                  </div>
                )}
                
                <div className="p-4 rounded-lg bg-secondary/80 flex flex-col items-center gap-3">
                  <div className="flex items-center justify-center gap-2 md:gap-4 w-full">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" disabled>
                      <Shuffle className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="hover:text-foreground" onClick={() => handleSeekBy(-10)} disabled={!generatedSequence}>
                      <SkipBack className="w-6 h-6" />
                    </Button>
                    <Button size="icon" className="w-14 h-14 rounded-full" onClick={handlePlayPause} disabled={!generatedSequence}>
                      {playbackState.isPlaying 
                        ? <Pause className="w-7 h-7 fill-foreground" /> 
                        : <Play className="w-7 h-7 fill-foreground ml-1" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => handleSeekBy(10)} disabled={!generatedSequence}>
                      <SkipForward className="w-6 h-6" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={handleRestart} disabled={!generatedSequence}>
                      <Repeat className="w-5 h-5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3 w-full">
                    <span className="text-xs font-mono text-muted-foreground w-10 text-right">{formatTime(currentTime)}</span>
                    <Slider
                        value={[playbackState.progress]}
                        onValueChange={handleProgressChange}
                        onValueCommit={handleSeekCommit}
                        className="w-full"
                        disabled={!generatedSequence}
                      />
                    <span className="text-xs font-mono text-muted-foreground w-10 text-left">{formatTime(totalTime)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label>Instrument</Label>
                    <Select value={String(selectedProgram)} onValueChange={(v) => setSelectedProgram(Number(v))} disabled={!generatedSequence}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an instrument" />
                      </SelectTrigger>
                      <SelectContent>
                        {instruments.map(inst => (
                          <SelectItem key={inst.program} value={String(inst.program)}>{inst.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label>Tempo: {playbackState.tempo} BPM</Label>
                    <Slider
                      value={[playbackState.tempo]}
                      onValueChange={([val]) => setPlaybackState(p => ({ ...p, tempo: val }))}
                      min={60} max={180} step={1}
                      disabled={!generatedSequence}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Volume: {playbackState.volume}%</Label>
                  <Slider
                    value={[playbackState.volume]}
                    onValueChange={([val]) => setPlaybackState(p => ({ ...p, volume: val }))}
                    min={0} max={100} step={1}
                    disabled={!generatedSequence}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-4">
                <div className="flex w-full gap-2">
                   <Button variant="outline" size="lg" className="w-full" onClick={handleShare} disabled={!generatedSequence}><Share2 className="w-5 h-5 mr-2"/> Share</Button>
                   <Button variant="outline" size="lg" className="w-full" onClick={handleDownload} disabled={!generatedSequence}>
                      <Download className="w-5 h-5 mr-2" /> Download
                   </Button>
                </div>
                <div className="flex items-center gap-2 w-full">
                  <Input readOnly value={generatedIdeas?.hashValue || ''} className="font-mono text-xs bg-secondary" disabled={!generatedSequence} />
                  <Button variant="outline" size="icon" onClick={() => handleCopy(generatedIdeas?.hashValue || '', 'Hash')} disabled={!generatedSequence}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>
          
          <div className="lg:col-span-2 space-y-8">
            <div className="hidden lg:block">
              {memoizedHistory}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Loader } from 'lucide-react';
import { WarVideoForm } from './WarVideoForm';
import { Champion } from '@/types/champion';
import { War, WarFight, Player as PrismaPlayer, WarNode as PrismaWarNode } from '@prisma/client';

// Define types for fetched data
type WarNode = PrismaWarNode;
type Player = PrismaPlayer;

interface InitialFormData {
  champions: Champion[];
  nodes: WarNode[];
  players: Player[];
  user: { id: string };
}

interface PreFilledFight extends WarFight {
  war: War;
  player: Player;
  attacker: Champion;
  defender: Champion;
  node: WarNode;
  prefightChampions: Champion[];
}

type PageStatus = 'loading' | 'ready' | 'error';

export default function UploadWarVideoPage() {
  const searchParams = useSearchParams();
  const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [token, setToken] = useState<string | null>(null);
  const [initialFormData, setInitialFormData] = useState<InitialFormData | null>(null);
  const [preFilledFights, setPreFilledFights] = useState<PreFilledFight[] | null>(null);

  const urlToken = searchParams.get('token');
  const sessionToken = searchParams.get('session_token');

  useEffect(() => {
    if (!urlToken && !sessionToken) {
      setErrorMessage('No upload token or session token found in URL.');
      setPageStatus('error');
      return;
    }

    const fetchData = async () => {
      try {
        if (sessionToken) {
          // New flow: session_token provides everything in one go.
          const response = await fetch(`/api/upload-session/${sessionToken}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch session data');
          }
          const data = await response.json();

          setInitialFormData({
            champions: data.champions,
            nodes: data.nodes,
            players: data.players,
            user: data.user,
          });
          setPreFilledFights(data.fights);
          setToken(data.token);
        } else if (urlToken) {
          // Old flow: token provides form data, no pre-filled fights.
          const response = await fetch(`/api/form-data?token=${urlToken}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch form data');
          }
          const formData: InitialFormData = await response.json();
          setInitialFormData(formData);
          setToken(urlToken);
          setPreFilledFights(null); // No pre-filled fights in this flow
        }
        setPageStatus('ready');
      } catch (error: unknown) {
        const err = error as Error;
        console.error('Failed to fetch data:', err);
        setErrorMessage(err.message || 'An unknown error occurred.');
        setPageStatus('error');
      }
    };

    fetchData();
  }, [urlToken, sessionToken]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  if (pageStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-2 sm:p-4">
        <div className="glass rounded-2xl border border-slate-800/50 p-6 sm:p-12 flex flex-col items-center gap-6 max-w-md w-full">
          <Loader className="h-16 w-16 animate-spin text-sky-400" />
          <div className="text-center">
            <h2 className="text-xl font-semibold text-white mb-2">Loading Fight Data</h2>
            <p className="text-sm text-slate-400">Please wait while we prepare your upload form...</p>
          </div>
        </div>
      </div>
    );
  }

  if (pageStatus === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-2 sm:p-4">
        <div className="glass rounded-2xl border border-red-500/20 p-6 sm:p-12 flex flex-col items-center gap-6 max-w-md w-full">
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <AlertTriangle className="h-10 w-10 text-red-400" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Link Invalid or Expired</h2>
            <p className="text-sm text-slate-300 mb-4">{errorMessage}</p>
            <p className="text-xs text-slate-400">Please request a new upload link from the CereBro bot in Discord.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-4 sm:py-8 px-2 sm:px-4">
      <div className="container mx-auto max-w-5xl px-0">
        <div className="glass rounded-xl sm:rounded-2xl border border-slate-800/50 overflow-hidden">
          <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border-b border-slate-800/50 p-4 sm:p-6">
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Upload Alliance War Video</h1>
            <p className="text-sm text-slate-300">Submit your MCOC Alliance War video and fight details.</p>
          </div>
          <div className="p-3 sm:p-6">
            {initialFormData && token && (
              <WarVideoForm
                token={token}
                initialChampions={initialFormData.champions}
                initialNodes={initialFormData.nodes}
                initialPlayers={initialFormData.players}
                initialUserId={initialFormData.user.id}
                preFilledFights={preFilledFights}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

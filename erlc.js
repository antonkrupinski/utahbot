// erlc.js

// Helper for interacting with the ERLC API
// Use global fetch when available (Node 18+); otherwise lazy-import node-fetch
let fetchFn;
if (typeof fetch !== 'undefined') {
    fetchFn = fetch;
} else {
    fetchFn = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
}

const ERLC_API_KEY = 'EGTuGOLLSCFohDVsyFrI-McPOMtPJsJdYXecuGcSptAqXXnQYhyEgrwHOQEHT';
const ERLC_API_URL = 'https://api.policeroleplay.community/v1/server/command';


async function runErlcCommand(command) {
    // Basic validation to prevent accidental destructive commands
    if (!command || typeof command !== 'string') {
        throw new Error('No command provided');
    }
    const trimmed = command.trim();
    if (!trimmed) {
        throw new Error('No command provided');
    }

    // Block obvious destructive admin commands coming from untrusted input
    const dangerousPattern = /\b(kick|ban|kickall|banall|remove|wipe)\b/i;
    if (dangerousPattern.test(trimmed)) {
        throw new Error('Refusing to execute dangerous server administration commands.');
    }

    const response = await fetchFn(ERLC_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'server-key': ERLC_API_KEY
        },
        body: JSON.stringify({ command: trimmed })
    });
    if (!response.ok) {
        throw new Error(`ERLC API error: ${response.statusText}`);
    }
    return response.json();
}

async function getErlcPlayers() {
    const url = 'https://api.policeroleplay.community/v1/server/players';
    const response = await fetchFn(url, {
        method: 'GET',
        headers: {
            'server-key': ERLC_API_KEY
        }
    });
    if (!response.ok) {
        throw new Error(`ERLC API error: ${response.statusText}`);
    }
    const data = await response.json();
    // If API returns an object with a players array, handle both shapes
    if (Array.isArray(data)) return data.length;
    if (data && Array.isArray(data.players)) return data.players.length;
    return 0;
}

module.exports = { runErlcCommand, getErlcPlayers };
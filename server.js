import express from 'express';
import fetch from 'node-fetch'; // Ensure node-fetch is installed
import cors from 'cors';
import { SPORT_IDS } from './config.js';

const app = express();
app.use(cors());

// Function to fetch all streams for a specific sport
async function fetchStreams(sportId) {
    try {
        const response = await fetch('https://ppv.land/api/streams');
        if (!response.ok) {
            throw new Error(`Failed to fetch streams: ${response.statusText}`);
        }
        const streamData = await response.json();
        const streams = streamData.streams.filter((element) => element.id === sportId);
        return streams || [];
    } catch (error) {
        console.error(`Error fetching streams for sport ID ${sportId}:`, error.message);
        throw error;
    }
}

// Function to fetch additional details for each stream
async function getNameAndLink(streams) {
    try {
        const data = [];
        for (const element of streams) {
            const response = await fetch(`https://ppv.land/api/streams/${element.id}`);
            if (!response.ok) {
                console.warn(`Failed to fetch details for stream ID ${element.id}: ${response.statusText}`);
                continue;
            }
            const jsonData = await response.json();
            const elementData = jsonData.data;

            const streamDetails = {
                id: elementData.id || null,
                link: elementData.m3u8 || null,
                name: elementData.name || 'Unknown Name',
                thumbnail: elementData.poster || null,
            };
            data.push(streamDetails);
        }
        return data;
    } catch (error) {
        console.error('Error fetching stream details:', error.message);
        throw error;
    }
}

// Function to fetch and process sports data
async function getSportsData(sportId) {
    try {
        const streams = await fetchStreams(sportId);
        if (!streams || streams.length === 0) {
            console.warn(`No streams found for sport ID ${sportId}`);
            return [];
        }
        return await getNameAndLink(streams);
    } catch (error) {
        console.error(`Error processing sports data for sport ID ${sportId}:`, error.message);
        throw error;
    }
}

// Endpoint for NBA data
app.get('/nba', async (req, res) => {
    try {
        const nbaData = await getSportsData(SPORT_IDS.NBA);
        res.json(nbaData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch NBA data' });
    }
});

// Endpoint for Football data
app.get('/football', async (req, res) => {
    try {
        const footballData = await getSportsData(SPORT_IDS.FOOTBALL);
        res.json(footballData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Football data' });
    }
});

// Default route
app.get('/', (req, res) => {
    res.send('Sports API is running. Use /nba or /football to fetch data.');
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

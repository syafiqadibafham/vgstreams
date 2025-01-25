import pkg from 'stremio-addon-sdk';
import fetch from "node-fetch";

const { addonBuilder, serveHTTP } = pkg;


const apiUrl = "https://ppv.land/";

// Define manifest (updated dynamically when catalogs are initialized)
const manifest = {
    id: "community.ppvaddon",
    version: "1.0.0",
    name: "PPV Sports Addon",
    description: "Live sports streams from the PPV API",
    resources: ["catalog", "meta", "stream"],
    types: ["sports", "hls"], // Only sports type is supported
    idPrefixes: ["ppv_"],
    catalogs: [], // Will be populated dynamically
};

let responseFromPPV = {};

// Fetch data from the API to generate catalogs dynamically
async function initializeManifest() {
    try {
        const response = await fetch(apiUrl+'api/streams');
        const data = await response.json();

        // Group data by category or type (adjust if API structure differs)
        const categories = data["streams"];
        categories.forEach(sportStreams => {
            responseFromPPV[sportStreams["id"]] = sportStreams["streams"];
        });
        // Generate catalog entries for each category
        manifest.catalogs = categories.map((category) => ({
            type: "sports",
            id: `ppv_${category.id}`,
            name: category.category,
        }));

        console.log("Dynamic catalogs initialized:", manifest.catalogs);
    } catch (err) {
        console.error("Error initializing catalogs:", err);
    }
}

async function defineMetaHandler(builder) {
    builder.defineMetaHandler(async ({ args }) => {
        console.log('id: '+ JSON.stringify(args, null, 4));  
        const [, sportId] = args.id.split("_");
        
        if (args.type === 'sports') {
            
            const metaObj = {
                id: args.id,
                type: category,
                name: stream.name,
                poster: stream.poster,
                posterShape: 'landscape',
                //genres: ['Sports', category],
            }
            return Promise.resolve({ meta: metaObj })
        } else {
            // otherwise return no meta
            return Promise.resolve({ meta: {} })
        }
        
    });
}

// Catalog handler
async function defineCatalogHandler(builder) {
    // Catalog handler for sports content
    builder.defineCatalogHandler(async ({ type, id }) => {
        const [, sportId] = id.split("_");
        const metas = [];
        const streams = [];
        console.log('fetch catalogs: ', id);
        
        try {            
            responseFromPPV[sportId].forEach(stream => {
                const metaId = `ppv_${stream.id}`;
                const category = stream["category_name"];
                const baseData = {
                    id: metaId,
                    type: category,
                    name: stream.name,
                    poster: stream.poster,
                    posterShape: 'landscape',
                    genres: ['Sports', category],
                };
                
                //sportStreamsJSON.metas.push(baseData);
                
                metas.push({
                    ...baseData,
                    description: `${category} Game: ${stream.name}`,
                    logo: stream.logo,
                    background: stream.poster,
                    runtime: '',
                });

                streams.push({
                    streams: [
                        {
                            title: stream.tag,
                            url: apiUrl + 'live/'+ stream["uri_name"],
                            type: 'tv',
                            behaviorHints: { notWebReady: false },
                            id: stream.id,
                            genre: 'Sports'
                        },
                    ]
                });
            }); 
            return { metas, streams };
            }
             catch (err) {
                console.error("Error fetching catalog:", err);
                return { metas: [] };
            }
    });
}

// Stream handler
async function defineStreamHandler(builder) {
    // Stream handler for sports content
    builder.defineStreamHandler(async({ id }) => {
        console.log('id: '+ JSON.stringify(id, null, 4));  
        const [, sportId] = id.split("_");
        const streams = [];
        

        try {
            // Map the API data to Stremio's stream format
            console.log('stream: '+ JSON.stringify(responseFromPPV[sportId], null, 4));  
            responseFromPPV[sportId].forEach(stream => {   
                streams.push({
                    streams: [
                        {
                            title: stream.tag,
                            url: apiUrl + 'live/'+ stream["uri_name"],
                            type: 'tv',
                            behaviorHints: { notWebReady: false },
                            id: stream.id,
                            genre: 'Sports'
                        },
                    ]
                });
            });
            /*
            const streams = data["streams"].map((stream) => ({
                title: stream["streams"].tag || "Stream",
                url: stream.streams.m3u8, // The playable stream URL
                description: stream.streams.description || null,
                type: 'tv',
                behaviorHints: { notWebReady: false },
                id: stream.streams.id,
            }));*/
            
            console.log(streams);

            return { streams };
        } catch (err) {
            console.error("Error fetching streams:", err);
            return { streams: [] };
        }
    });
}

// Main function to initialize and serve the addon
(async () => {
    await initializeManifest(); // Populate manifest.catalogs

    // Create the addon with the dynamically updated manifest
    const builder = new addonBuilder(manifest);

    // Define handlers
    await defineStreamHandler(builder);
    await defineMetaHandler(builder);
    await defineCatalogHandler(builder);

    // Serve the addon
    serveHTTP(builder.getInterface(), { port: 7000 });
})();


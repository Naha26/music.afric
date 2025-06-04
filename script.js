
const SUPABASE_URL = 'https://eamqphykswssydupflow.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhbXFwaHlrc3dzc3lkdXBmbG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5Mzg2NDQsImV4cCI6MjA2NDUxNDY0NH0.l4Yh_Iug43eBG7rD2VcVA6iYKZI7kcEpRMSOe0JtFw0';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const uploadForm = document.getElementById('upload-form');
const mixesContainer = document.getElementById('mixes-container');
const musicPlayer = document.getElementById('music-player');
const downloadButton = document.getElementById('download-button');
const searchInput = document.getElementById('search-input');
const loadingIndicator = document.getElementById('loading-indicator');

let currentMixUrl = null;
let currentMixName = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    fetchMixes();
    searchInput.addEventListener('input', searchMixes);
});

// Fetch mixes from Supabase
async function fetchMixes() {
    try {
        showLoading(true);
        
        const { data, error } = await supabase
            .from('mixes')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        displayMixes(data);
    } catch (error) {
        console.error('Error fetching mixes:', error);
        alert('Failed to load mixes. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Display mixes in the UI
function displayMixes(mixes) {
    mixesContainer.innerHTML = mixes.length > 0 ? '' : '<p>No mixes found</p>';

    mixes.forEach(mix => {
        const mixCard = document.createElement('div');
        mixCard.className = 'mix-card';
        
        mixCard.innerHTML = `
            <h3>${mix.dj_name || 'Unknown DJ'}</h3>
            <p class="description">${mix.description || 'No description'}</p>
            <p class="location">📍 ${mix.location || 'Unknown location'}</p>
            <button onclick="playMix('${mix.audio_url}', '${mix.dj_name || mix.audio_url.split('/').pop()}')">
                ▶ Play
            </button>
        `;
        
        mixesContainer.appendChild(mixCard);
    });
}

// Play a selected mix
function playMix(audioUrl, mixName) {
    try {
        musicPlayer.src = audioUrl;
        musicPlayer.play()
            .then(() => {
                currentMixUrl = audioUrl;
                currentMixName = mixName;
                downloadButton.style.display = 'inline-block';
                downloadButton.textContent = `Download ${mixName}`;
            })
            .catch(error => {
                console.error('Playback failed:', error);
                alert('Failed to play audio. The file might be corrupted or in an unsupported format.');
            });
    } catch (error) {
        console.error('Error playing mix:', error);
        alert('Error initializing playback.');
    }
}

// Handle file download
downloadButton.addEventListener('click', () => {
    if (currentMixUrl) {
        downloadFile(currentMixUrl, currentMixName);
    }
});

function downloadFile(url, fileName) {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || url.split('/').pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Search functionality
async function searchMixes() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    try {
        showLoading(true);
        
        if (!searchTerm) {
            await fetchMixes();
            return;
        }

        const { data, error } = await supabase
            .from('mixes')
            .select('*')
            .or(`dj_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`);

        if (error) throw error;
        
        displayMixes(data);
    } catch (error) {
        console.error('Search error:', error);
        alert('Search failed. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Handle form submission
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const djName = document.getElementById('dj-name').value.trim();
    const description = document.getElementById('description').value.trim();
    const location = document.getElementById('location').value.trim();
    const audioFile = document.getElementById('audio-file').files[0];

    if (!audioFile) {
        alert('Please select an audio file.');
        return;
    }

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg'];
    if (!validTypes.includes(audioFile.type)) {
        alert('Please upload a valid audio file (MP3, WAV, or OGG).');
        return;
    }

    try {
        showLoading(true);
        
        // Upload to storage with unique filename
        const fileExt = audioFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `music/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('music')
            .upload(filePath, audioFile);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('music')
            .getPublicUrl(filePath);

        // Insert into database
        const { error: dbError } = await supabase
            .from('mixes')
            .insert([{
                dj_name: djName || 'Anonymous DJ',
                description: description,
                location: location,
                audio_url: urlData.publicUrl
            }]);

        if (dbError) throw dbError;

        alert('Mix uploaded successfully!');
        uploadForm.reset();
        await fetchMixes();
    } catch (error) {
        console.error('Upload error:', error);
        alert(`Upload failed: ${error.message}`);
    } finally {
        showLoading(false);
    }
});

// Helper function to show/hide loading indicator
function showLoading(show) {
    if (loadingIndicator) {
        loadingIndicator.style.display = show ? 'block' : 'none';
    }
}

// Add error handling for audio player
musicPlayer.addEventListener('error', () => {
    console.error('Audio player error:', musicPlayer.error);
    alert('Error playing audio. The file might be corrupted or in an unsupported format.');
});
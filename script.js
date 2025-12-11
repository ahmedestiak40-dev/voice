const recordButton = document.getElementById('record-button');
const stopButton = document.getElementById('stop-button');
const pauseButton = document.getElementById('pause-button');
const activeControls = document.getElementById('active-controls');
const statusMessage = document.getElementById('status-message');
const timerElement = document.getElementById('timer');
const audioList = document.getElementById('audio-list');

let mediaRecorder;
let audioChunks = [];
let stream;
let isRecording = false;
let isPaused = false;
let timerInterval;
let startTime;
let timeElapsed = 0;

// Event Listeners
recordButton.addEventListener('click', () => {
    if (!isRecording) {
        startRecording();
    }
});

stopButton.addEventListener('click', stopRecording);
pauseButton.addEventListener('click', togglePauseResume);

// --- Timer Functions ---

/**
 * Updates the timer display every second.
 */
function startTimer() {
    startTime = Date.now() - timeElapsed;
    timerElement.classList.add('active');
    timerInterval = setInterval(() => {
        timeElapsed = Date.now() - startTime;
        let totalSeconds = Math.floor(timeElapsed / 1000);
        let hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        let minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        let seconds = String(totalSeconds % 60).padStart(2, '0');
        timerElement.textContent = `${hours}:${minutes}:${seconds}`;
    }, 1000);
}

/**
 * Resets and stops the timer.
 */
function resetTimer() {
    clearInterval(timerInterval);
    timerElement.textContent = '00:00:00';
    timerElement.classList.remove('active');
    timeElapsed = 0;
}

// --- Recording Control Functions ---

async function startRecording() {
    try {
        statusMessage.textContent = 'Requesting microphone access...';
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = finishRecording;

        mediaRecorder.start();
        isRecording = true;
        
        // UI Updates
        recordButton.classList.add('recording');
        activeControls.classList.remove('hidden');
        recordButton.disabled = true; // Disable the mic button when controls are visible
        statusMessage.textContent = 'Recording...';
        pauseButton.innerHTML = '<i class="fas fa-pause"></i>';
        pauseButton.classList.remove('resuming');
        isPaused = false;
        
        startTimer();

    } catch (error) {
        console.error('Error accessing microphone:', error);
        statusMessage.textContent = 'Error: Microphone access denied or not available.';
        recordButton.disabled = false;
    }
}

function togglePauseResume() {
    if (!mediaRecorder) return;

    if (isPaused) {
        // RESUME
        mediaRecorder.resume();
        isPaused = false;
        pauseButton.innerHTML = '<i class="fas fa-pause"></i>';
        pauseButton.classList.remove('resuming');
        statusMessage.textContent = 'Recording...';
        startTimer(); // Restart timer from current timeElapsed
    } else {
        // PAUSE
        mediaRecorder.pause();
        isPaused = true;
        pauseButton.innerHTML = '<i class="fas fa-play"></i>';
        pauseButton.classList.add('resuming');
        statusMessage.textContent = 'Recording Paused. Tap play to resume.';
        clearInterval(timerInterval); // Stop timer visually
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    
    // UI Cleanup (will be completed in finishRecording)
    statusMessage.textContent = 'Processing audio...';
    recordButton.disabled = false;
    recordButton.classList.remove('recording');
    activeControls.classList.add('hidden');
    resetTimer();
    isRecording = false;
    isPaused = false;
}

/**
 * Executed after mediaRecorder.onstop fires.
 */
function finishRecording() {
    // 1. Combine audio chunks
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const audioUrl = URL.createObjectURL(audioBlob);

    // 2. Stop the microphone stream
    stream.getTracks().forEach(track => track.stop());
    
    // 3. Add to the display
    addAudioToDisplay(audioUrl, timeElapsed);

    statusMessage.textContent = 'Ready to record again.';
}


// --- List Management Functions ---

/**
 * Creates and appends an audio playback item to the list.
 */
function addAudioToDisplay(audioUrl, durationMs) {
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    const defaultName = `Recording ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} (${minutes}:${seconds})`;

    // Create container
    const itemDiv = document.createElement('div');
    itemDiv.className = 'recording-item';
    itemDiv.dataset.url = audioUrl;

    // Recording Info/Actions
    const infoDiv = document.createElement('div');
    infoDiv.className = 'recording-info';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'recording-name';
    nameSpan.textContent = defaultName;

    const actionDiv = document.createElement('div');
    actionDiv.className = 'recording-actions';

    // Rename Button
    const renameBtn = document.createElement('button');
    renameBtn.innerHTML = '<i class="fas fa-pen"></i>';
    renameBtn.title = 'Rename';
    renameBtn.onclick = () => renameRecording(nameSpan);

    // Download Button
    const downloadBtn = document.createElement('button');
    downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
    downloadBtn.title = 'Download';
    downloadBtn.onclick = () => downloadRecording(audioUrl, nameSpan.textContent);

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.title = 'Delete';
    deleteBtn.onclick = () => deleteRecording(itemDiv);

    actionDiv.appendChild(renameBtn);
    actionDiv.appendChild(downloadBtn);
    actionDiv.appendChild(deleteBtn);

    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(actionDiv);

    // Audio Player
    const audioEl = document.createElement('audio');
    audioEl.controls = true;
    audioEl.src = audioUrl;
    audioEl.className = 'recording-player';

    itemDiv.appendChild(infoDiv);
    itemDiv.appendChild(audioEl);
    audioList.prepend(itemDiv); // Add to the top of the list
}

function renameRecording(nameElement) {
    const currentName = nameElement.textContent;
    const newName = prompt('Enter a new name for the recording:', currentName);

    if (newName && newName.trim() !== "") {
        nameElement.textContent = newName.trim();
    }
}

function deleteRecording(itemElement) {
    if (confirm('Are you sure you want to delete this recording?')) {
        // Revoke the blob URL to free up memory
        const url = itemElement.dataset.url;
        URL.revokeObjectURL(url); 
        itemElement.remove();
    }
}

function downloadRecording(url, filename) {
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style = 'display: none';
    a.href = url;
    // Ensure the filename has a file extension
    a.download = `${filename.replace(/[^a-z0-9]/gi, '_')}.webm`;
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}
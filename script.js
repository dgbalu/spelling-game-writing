const worker = Tesseract.createWorker({
    logger: m => console.log(m)
});

// Initialize Tesseract
(async () => {
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    await worker.setParameters({
        tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyz'
    });
})();

const WORDS = {
    "pram": "A small carriage for a baby",
    "latch": "A door ___ keeps it closed",
    "shed": "A small building for storing tools and equipment",
    "twin": "One of two siblings born at the same time",
    "why": "Ask this when you want to know the reason",
    "flew": "Past tense of fly - the bird ___ away",
    "drum": "A musical instrument you hit to make sound",
    "flu": "A common illness that makes you feel sick",
    "clock": "Tells you the time on the wall",
    "flex": "To bend or stretch your muscles"
}; 

let currentWord = '';
let currentGameMode = '';
let score = 0;
let totalRounds = 0;
let currentWordIndex = 0;
let isDrawing = false;
let context;
let canvas;

// Simple sound setup with reliable URLs
const correctSound = new Audio('./sounds/Yay thats right.m4a');
const wrongSound = new Audio('./sounds/Ohh man.m4a');

// Basic error handling
correctSound.onerror = () => console.log('Error loading correct sound');
wrongSound.onerror = () => console.log('Error loading wrong sound');

// Add text-to-speech functionality
const speech = new SpeechSynthesisUtterance();
speech.rate = 0.9;  // Slightly slower for clarity
speech.pitch = 1;

// Add new game mode
function speakWord(word) {
    speech.text = word;
    window.speechSynthesis.speak(speech);
}

// Add repeat timer functionality
let repeatTimer = null;

function startRepeatTimer(word) {
    clearTimeout(repeatTimer);  // Clear any existing timer
    repeatTimer = setTimeout(() => {
        speakWord(word);  // Repeat word after delay
    }, 5000);  // 5 seconds delay
}

function stopRepeatTimer() {
    clearTimeout(repeatTimer);
}

function startGame(mode) {
    currentGameMode = mode;
    document.getElementById('welcome-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    document.getElementById('game-screen').setAttribute('data-mode', mode);
    
    setupGame(mode);
}

function setupGame(mode) {
    currentWord = getRandomWord();
    const wordDisplay = document.getElementById('word-display');
    const hint = document.getElementById('hint');
    const gameTitle = document.getElementById('game-title');
    
    switch(mode) {
        case 'spelling':
            gameTitle.textContent = '🎧 Spelling Practice';
            wordDisplay.textContent = '👂 Listen and Type';
            speakWord(currentWord);
            startRepeatTimer(currentWord);
            break;
        case 'scramble':
            gameTitle.textContent = '🎲 Unscramble the Word';
            wordDisplay.textContent = scrambleWord(currentWord);
            break;
        case 'blanks':
            gameTitle.textContent = '🎯 Fill in the Blanks';
            wordDisplay.textContent = createBlanks(currentWord);
            break;
    }
    
    hint.textContent = mode === 'spelling' ? 
        "Type the word you hear. Click 'Hear Again' to repeat." : 
        `Hint: ${WORDS[currentWord]}`;
    
    document.getElementById('user-input').value = '';
    document.getElementById('message').textContent = '';
}

function checkAnswer(manualInput) {
    const userInput = manualInput || document.getElementById('user-input').value.toLowerCase().trim();
    const message = document.getElementById('message');
    
    if (userInput === currentWord) {
        correctSound.play().catch(() => {});
        score++;
        message.textContent = '🎉 Fantastic! You got it right!';
        message.style.color = '#28a745';
    } else {
        wrongSound.play().catch(() => {});
        message.textContent = `Sorry, the correct word was: ${currentWord.toUpperCase()}`;
        message.style.color = '#dc3545';
    }
    
    totalRounds++;
    updateScore();
    
    // Add delay only for spelling mode
    const delay = currentGameMode === 'spelling' ? 4000 : 2000;  // 4 seconds for spelling, 2 for others
    
    setTimeout(() => {
        setupGame(currentGameMode);
    }, delay);
}

// Add welcome sound
const welcomeSound = new Audio('./sounds/Hey Atharva.m4a');
welcomeSound.playbackRate = 1.25;  // Speed up the welcome message

// Play welcome sound function
function playWelcomeSound() {
    welcomeSound.play().catch((error) => {
        console.log('Error playing welcome sound:', error);
        // For Chrome: Add a button to play sound if autoplay fails
        const playButton = document.createElement('button');
        playButton.textContent = '🔊 Click to Start';
        playButton.className = 'welcome-sound-btn';
        playButton.onclick = () => {
            welcomeSound.play();
            playButton.remove();
        };
        document.querySelector('.container').prepend(playButton);
    });
}

// Try to play sound when page loads
document.addEventListener('DOMContentLoaded', function() {
    // ... existing DOMContentLoaded code ...

    // Setup canvas
    canvas = document.getElementById('writing-pad');
    context = canvas.getContext('2d');
    
    // Set canvas size
    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = 200;
        context.lineWidth = 3;
        context.lineCap = 'round';
        context.strokeStyle = '#333';
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Touch events for drawing
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);

    // Clear and recognize buttons
    document.getElementById('clear-btn').addEventListener('click', clearCanvas);
    document.getElementById('recognize-btn').addEventListener('click', recognizeHandwriting);
});

function startDrawing(e) {
    isDrawing = true;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    context.beginPath();
    context.moveTo(
        touch.clientX - rect.left,
        touch.clientY - rect.top
    );
    e.preventDefault();
}

function draw(e) {
    if (!isDrawing) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    context.lineTo(
        touch.clientX - rect.left,
        touch.clientY - rect.top
    );
    context.stroke();
    e.preventDefault();
}

function stopDrawing() {
    isDrawing = false;
}

function clearCanvas() {
    context.clearRect(0, 0, canvas.width, canvas.height);
}

// Update the recognizeHandwriting function
async function recognizeHandwriting() {
    try {
        // Preprocess the canvas
        const processedCanvas = await preprocessCanvas();
        const { data: { text } } = await worker.recognize(processedCanvas);
        
        // Clean and process the recognized text
        const cleanText = text.toLowerCase().trim().replace(/[^a-z]/g, '');
        console.log('Recognized text:', cleanText);
        
        if (cleanText) {
            checkAnswer(cleanText);
            // Clear canvas after successful recognition
            clearCanvas();
        } else {
            document.getElementById('message').textContent = '✏️ Please write more clearly';
            document.getElementById('message').style.color = '#f39c12';
        }
    } catch (error) {
        console.error('Recognition failed:', error);
        document.getElementById('message').textContent = '❌ Recognition failed, please try again';
        document.getElementById('message').style.color = '#e74c3c';
    }
}

// Add image preprocessing function
async function preprocessCanvas() {
    // Create a new canvas for processing
    const processCanvas = document.createElement('canvas');
    const processCtx = processCanvas.getContext('2d');
    
    // Set same dimensions as original canvas
    processCanvas.width = canvas.width;
    processCanvas.height = canvas.height;
    
    // Draw original canvas content
    processCtx.drawImage(canvas, 0, 0);
    
    // Get image data
    const imageData = processCtx.getImageData(0, 0, processCanvas.width, processCanvas.height);
    const data = imageData.data;
    
    // Increase contrast and convert to black and white
    for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const threshold = 128;
        
        // Convert to black or white based on threshold
        const value = brightness < threshold ? 0 : 255;
        data[i] = value;     // R
        data[i + 1] = value; // G
        data[i + 2] = value; // B
    }
    
    // Put processed image data back
    processCtx.putImageData(imageData, 0, 0);
    
    // Crop to content area
    const bounds = getContentBounds(processCtx, processCanvas.width, processCanvas.height);
    if (bounds) {
        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = bounds.width;
        croppedCanvas.height = bounds.height;
        const croppedCtx = croppedCanvas.getContext('2d');
        
        croppedCtx.drawImage(processCanvas, 
            bounds.x, bounds.y, bounds.width, bounds.height,
            0, 0, bounds.width, bounds.height
        );
        
        return croppedCanvas;
    }
    
    return processCanvas;
}

// Add function to find content bounds
function getContentBounds(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    
    // Find content boundaries
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (data[i] < 255) { // If pixel is not white
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }
    
    // Add padding
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width, maxX + padding);
    maxY = Math.min(height, maxY + padding);
    
    // Return null if no content found
    if (minX >= maxX || minY >= maxY) {
        return null;
    }
    
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

// Update canvas setup to improve drawing quality
function setupCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 200;
    
    // Improve line quality
    context.lineWidth = 4;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#000';
    
    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = rect.width + "px";
    canvas.style.height = "200px";
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    context.scale(dpr, dpr);
}

// Update showWelcomeScreen function
function showWelcomeScreen() {
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('welcome-screen').classList.add('active');
    score = 0;
    totalRounds = 0;
    updateScore();
    playWelcomeSound();
}

// Helper functions
function getRandomWord() {
    const words = Object.keys(WORDS);
    if (currentWordIndex >= words.length) {
        currentWordIndex = 0; // Reset to start if we've shown all words
    }
    return words[currentWordIndex++];
}

function scrambleWord(word) {
    let scrambled;
    do {
        scrambled = word.split('')
            .sort(() => Math.random() - 0.5)
            .join('')
            .toUpperCase();
    } while (scrambled === word.toUpperCase()); // Keep trying until we get a different arrangement
    
    return scrambled;
}

function createBlanks(word) {
    const blanks = Array(word.length).fill('_');
    const revealCount = Math.floor(word.length / 2);
    const positions = new Set();
    
    while(positions.size < revealCount) {
        positions.add(Math.floor(Math.random() * word.length));
    }
    
    positions.forEach(pos => {
        blanks[pos] = word[pos].toUpperCase();
    });
    
    return blanks.join(' ');
}

function updateScore() {
    document.getElementById('score').textContent = score;
    document.getElementById('total').textContent = totalRounds;
}

function startTimer() {
    const timer = document.getElementById('timer');
    timer.classList.remove('hidden');
    let time = 0;
    
    const interval = setInterval(() => {
        time += 0.1;
        timer.textContent = `Time: ${time.toFixed(1)}s`;
    }, 100);
    
    document.getElementById('user-input').addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            clearInterval(interval);
            checkAnswer();
        }
    });
}

// Event Listeners
document.getElementById('user-input').addEventListener('keyup', function(e) {
    if (e.key === 'Enter') {
        checkAnswer();
    }
}); 
const audioPlayer = document.getElementById('audio-player');
const playPauseBtnBottom = document.getElementById('play-pause-btn-bottom');
const volumeSliderBottom = document.getElementById('volume-slider-bottom');
const progressBarBottom = document.querySelector('.progress-bar-bottom');
const progressContainerBottom = document.querySelector('.progress-container-bottom');
const currentTimeSpanBottom = document.querySelector('.current-time-bottom');
const durationSpanBottom = document.querySelector('.duration-bottom');
const songTitleBottom = document.querySelector('.song-title-bottom');
const volumeIconBtn = document.querySelector('.volume-controls-bottom .volume-icon-btn');
const fileInput = document.getElementById('file-input');
const addFilesBtn = document.querySelector('.add-files-btn');
const queueList = document.querySelector('.queue-list');
let defaultSongElement = document.getElementById('default-song');
const clearQueueBtn = document.getElementById('clear-queue-btn');
let isPlaying = false;
let playlist = []; 
let currentSongIndex = -1;
const DB_NAME = 'MusicPlayerDB';
const DB_VERSION = 3; 
const OBJECT_STORE_SONGS = 'songs'; 
const OBJECT_STORE_SETTINGS = 'settings'; 
let db;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function(event) {
            db = event.target.result;
            if (db.objectStoreNames.contains(OBJECT_STORE_SONGS)) {
                db.deleteObjectStore(OBJECT_STORE_SONGS);
            }
            if (db.objectStoreNames.contains(OBJECT_STORE_SETTINGS)) {
                db.deleteObjectStore(OBJECT_STORE_SETTINGS);
            }

            db.createObjectStore(OBJECT_STORE_SONGS, { keyPath: 'id', autoIncrement: true });
            db.createObjectStore(OBJECT_STORE_SETTINGS, { keyPath: 'name' });

            console.log(`IndexedDB upgraded to version ${DB_VERSION}. Stores created.`);
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            console.log('IndexedDB opened successfully');
            resolve(db);
            loadSettings();
            loadPlaylistFromDB();
        };

        request.onerror = function(event) {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };
    });
}

function addSongToDB(file) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([OBJECT_STORE_SONGS], 'readwrite');
        const store = transaction.objectStore(OBJECT_STORE_SONGS);

        const songData = {
            name: file.name.replace('.mp3', ''),
            file: file, 
            duration: '0:00'
        };

        const request = store.add(songData);

        request.onsuccess = function() {
            console.log(`Song "${file.name}" added to IndexedDB`);
            resolve(request.result); 
        };

        request.onerror = function(event) {
            console.error('Error adding song to DB:', event.target.error);
            reject(event.target.error);
        };
    });
}

function loadPlaylistFromDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
            console.error('IndexedDB not initialized.');
            return reject('DB not initialized');
        }

        const transaction = db.transaction([OBJECT_STORE_SONGS], 'readonly');
        const store = transaction.objectStore(OBJECT_STORE_SONGS);
        const request = store.getAll();

        request.onsuccess = function() {
            playlist = []; 
            queueList.innerHTML = ''; 

            if (defaultSongElement) {
                 defaultSongElement.remove();
                 defaultSongElement = null;
            }

            const storedSongs = request.result;
            if (storedSongs.length === 0) {
                if (!defaultSongElement) {
                    const placeholder = document.createElement('div');
                    placeholder.classList.add('queue-item');
                    placeholder.id = 'default-song';
                    placeholder.innerHTML = `
                        <div class="song-icon"><i class="fas fa-music"></i></div>
                        <div class="song-details">
                            <div class="song-title">Load a Song...</div>
                            <div class="song-meta">Unknown...</div>
                        </div>
                        <div class="song-duration">0:00</div>
                    `;
                    queueList.appendChild(placeholder);
                    defaultSongElement = placeholder;
                }
                return resolve(true);
            }

            storedSongs.forEach((storedSong, index) => {
                if (storedSong.file instanceof Blob) {
                    const objectURL = URL.createObjectURL(storedSong.file);
                    const song = {
                        id: storedSong.id,
                        file: storedSong.file,
                        url: objectURL, 
                        name: storedSong.name,
                        duration: storedSong.duration
                    };
                    playlist.push(song);
                    addSongToQueueUI(song, playlist.length - 1);
                } else {
                    console.error('Zapisany plik nie jest poprawnym obiektem Blob i zostanie pominięty:', storedSong.file);
                }
            });

            console.log('Playlist loaded from IndexedDB:', playlist);
            if (playlist.length > 0 && currentSongIndex === -1) {
                currentSongIndex = 0;
                const songToPlay = playlist[currentSongIndex];
                if (songToPlay && songToPlay.url) { 
                    audioPlayer.src = songToPlay.url;
                    audioPlayer.load();
                    songTitleBottom.textContent = songToPlay.name;
                    document.querySelector(`.queue-item[data-index="${currentSongIndex}"]`).classList.add('active-song');
                } else if (songToPlay) {
                    songTitleBottom.textContent = 'Błąd wczytywania utworu';
                    console.error('Błąd: Utwór załadowany z DB nie ma URL:', songToPlay);
                }
            }
            resolve(true);
        };

        request.onerror = function(event) {
            console.error('Error loading playlist from DB:', event.target.error);
            reject(event.target.error);
        };
    });
}

function clearAllSongsFromDB() {
    return new Promise((resolve, reject) => {
        if (!db) {
            console.error('IndexedDB not initialized.');
            return reject('DB not initialized');
        }
        const transaction = db.transaction([OBJECT_STORE_SONGS], 'readwrite');
        const store = transaction.objectStore(OBJECT_STORE_SONGS);
        const request = store.clear();

        request.onsuccess = function() {
            console.log('All songs cleared from IndexedDB');
            playlist.forEach(song => {
                if (song.url) {
                    URL.revokeObjectURL(song.url);
                }
            });
            playlist = [];
            currentSongIndex = -1;
            audioPlayer.src = ''; 
            isPlaying = false;
            playPauseBtnBottom.innerHTML = '<i class="fas fa-play"></i>';
            songTitleBottom.textContent = 'Load a Song...';
            currentTimeSpanBottom.textContent = '0:00';
            durationSpanBottom.textContent = '0:00';
            progressBarBottom.style.width = '0%';
            queueList.innerHTML = '';
            const placeholder = document.createElement('div');
            placeholder.classList.add('queue-item');
            placeholder.id = 'default-song';
            placeholder.innerHTML = `
                <div class="song-icon"><i class="fas fa-music"></i></div>
                <div class="song-details">
                    <div class="song-title">Load a Song...</div>
                    <div class="song-meta">Unknown</div>
                </div>
                <div class="song-duration">0:00</div>
            `;
            queueList.appendChild(placeholder);
            defaultSongElement = placeholder;

            resolve(true);
        };

        request.onerror = function(event) {
            console.error('Error clearing songs from DB:', event.target.error);
            reject(event.target.error);
        };
    });
}

function saveSetting(name, value) {
    if (!db) {
        console.error('IndexedDB not initialized, cannot save setting.');
        return;
    }
    const transaction = db.transaction([OBJECT_STORE_SETTINGS], 'readwrite');
    const store = transaction.objectStore(OBJECT_STORE_SETTINGS);
    const request = store.put({ name: name, value: value });

    request.onsuccess = () => console.log(`Setting "${name}" saved: ${value}`);
    request.onerror = (event) => console.error(`Error saving setting "${name}":`, event.target.error);
}

function loadSettings() {
    if (!db) {
        console.error('IndexedDB not initialized, cannot load settings.');
        return;
    }
    const transaction = db.transaction([OBJECT_STORE_SETTINGS], 'readonly');
    const store = transaction.objectStore(OBJECT_STORE_SETTINGS);

    store.get('theme').onsuccess = function(event) {
        const setting = event.target.result;
        if (setting && setting.value) {
            applyTheme(setting.value);
            document.getElementById(`theme-${setting.value}`).checked = true;
        } else {
            applyTheme('dark'); 
            document.getElementById('theme-dark').checked = true;
        }
    };
    store.get('theme').onerror = (event) => console.error('Error loading theme setting:', event.target.error);

    store.get('accentColor').onsuccess = function(event) {
        const setting = event.target.result;
        if (setting && setting.value) {
            applyAccentColor(setting.value);
            const selectedColorInput = document.querySelector(`input[name="accent-color"][data-color="${setting.value}"]`);
            if (selectedColorInput) {
                selectedColorInput.checked = true;
            }
        } else {
            applyAccentColor('orange'); 
            const defaultColorInput = document.querySelector(`input[name="accent-color"][data-color="orange"]`);
            if (defaultColorInput) {
                defaultColorInput.checked = true;
            }
        }
    };
    store.get('accentColor').onerror = (event) => console.error('Error loading accent color setting:', event.target.error);
}


function applyTheme(themeName) {
    document.body.className = '';
    if (themeName === 'light') {
        document.body.classList.add('light-theme');
    }
}

function applyAccentColor(colorName) {
    const root = document.documentElement; 
    let colorValue;
    switch (colorName) {
        case 'orange':
            colorValue = '#ff8c00';
            break;
        case 'blue':
            colorValue = '#0078d4'; // Standardowy niebieski z Windows
            break;
        case 'green':
            colorValue = '#10893E'; // Zielony, nieco ciemniejszy
            break;
        case 'purple':
            colorValue = '#886CE4'; // Fioletowy
            break;
        case 'red':
            colorValue = '#E81123'; // Czerwony
            break;
        default:
            colorValue = '#ff8c00'; // Domyślnie pomarańczowy
    }
    root.style.setProperty('--accent-orange', colorValue);

    const addFilesBtnElement = document.querySelector('.header-actions .add-files-btn');
    if (addFilesBtnElement) {
        addFilesBtnElement.style.backgroundColor = colorValue;
    }
    const mainPlayPauseBtn = document.getElementById('play-pause-btn-bottom');
    if (mainPlayPauseBtn) {
        mainPlayPauseBtn.style.backgroundColor = colorValue;
    }
    progressBarBottom.style.backgroundColor = colorValue;

    const existingStyle = document.getElementById('dynamic-accent-style');
    if (existingStyle) {
        existingStyle.remove();
    }
    const style = document.createElement('style');
    style.id = 'dynamic-accent-style';
    style.innerHTML = `
        #volume-slider-bottom::-webkit-slider-thumb {
            background: ${colorValue};
        }
        #volume-slider-bottom::-moz-range-thumb {
            background: ${colorValue};
        }
        .nav-list li.active {
            border-left-color: ${colorValue};
        }
        .theme-options input[type="radio"]:checked {
            border-color: ${colorValue};
        }
        .theme-options input[type="radio"]:checked::before {
            background-color: ${colorValue};
        }
        .accent-color-options input[type="radio"]:checked + label.color-preview {
            box-shadow: 0 0 0 2px ${colorValue};
        }
    `;
    document.head.appendChild(style);
}


const navHome = document.getElementById('nav-home'); 
const navQueue = document.getElementById('nav-queue');
const navSettings = document.getElementById('nav-settings');
const homeView = document.getElementById('home-view'); 
const queueView = document.getElementById('queue-view');
const settingsView = document.getElementById('settings-view');

const themeRadios = document.querySelectorAll('input[name="theme"]');
const accentColorOptions = document.querySelectorAll('input[name="accent-color"]');


playPauseBtnBottom.addEventListener('click', togglePlayPause);
volumeSliderBottom.addEventListener('input', setVolume);
progressContainerBottom.addEventListener('click', setProgress);
volumeIconBtn.addEventListener('click', toggleMute);

addFilesBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', addSongsToPlaylist);

document.querySelector('.player-btn:nth-child(2)').addEventListener('click', playPreviousSong);
document.querySelector('.player-btn:nth-child(4)').addEventListener('click', playNextSong);

clearQueueBtn.addEventListener('click', clearAllSongsFromDB);


navHome.addEventListener('click', () => { 
    switchView('home');
    setActiveNavLink(navHome);
});

navQueue.addEventListener('click', () => {
    switchView('queue');
    setActiveNavLink(navQueue);
});

navSettings.addEventListener('click', () => {
    switchView('settings');
    setActiveNavLink(navSettings);
});


themeRadios.forEach(radio => {
    radio.addEventListener('change', (event) => {
        const selectedTheme = event.target.value;
        applyTheme(selectedTheme);
        saveSetting('theme', selectedTheme);
    });
});


accentColorOptions.forEach(radio => {
    radio.addEventListener('change', (event) => {
        const selectedColor = event.target.dataset.color; 
        applyAccentColor(selectedColor);
        saveSetting('accentColor', selectedColor);
    });
});



audioPlayer.addEventListener('timeupdate', updateProgress);
audioPlayer.addEventListener('ended', playNextSong);
audioPlayer.addEventListener('loadedmetadata', () => {
    if (currentSongIndex !== -1 && playlist[currentSongIndex]) {
        const duration = isNaN(audioPlayer.duration) || !isFinite(audioPlayer.duration) ? 0 : audioPlayer.duration;
        playlist[currentSongIndex].duration = formatTime(duration);
        const activeItemDurationSpan = document.querySelector(`.queue-item[data-index="${currentSongIndex}"] .song-duration`);
        if (activeItemDurationSpan) {
            activeItemDurationSpan.textContent = playlist[currentSongIndex].duration;
        }
    }
    durationSpanBottom.textContent = formatTime(audioPlayer.duration);
});
audioPlayer.addEventListener('error', (e) => {
    console.error('Błąd odtwarzania audio:', e);
    isPlaying = false;
    playPauseBtnBottom.innerHTML = '<i class="fas fa-play"></i>';
    songTitleBottom.textContent = 'Błąd odtwarzania';
});


function togglePlayPause() {
    if (playlist.length === 0) {
        alert('Brak utworów do odtwarzania. Dodaj pliki MP3.');
        return;
    }

    if (currentSongIndex === -1) {
        playSong(0);
        return;
    }

    if (isPlaying) {
        audioPlayer.pause();
        playPauseBtnBottom.innerHTML = '<i class="fas fa-play"></i>';
    } else {
        audioPlayer.play();
        playPauseBtnBottom.innerHTML = '<i class="fas fa-pause"></i>';
    }
    isPlaying = !isPlaying;
}

function setVolume() {
    audioPlayer.volume = volumeSliderBottom.value;
    updateVolumeIcon();
}

let lastVolume = 1;

function updateVolumeIcon() {
    if (audioPlayer.muted || audioPlayer.volume === 0) {
        volumeIconBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
    } else if (audioPlayer.volume < 0.5) {
        volumeIconBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
    } else {
        volumeIconBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    }
}

function toggleMute() {
    if (audioPlayer.muted) {
        audioPlayer.muted = false;
        audioPlayer.volume = lastVolume;
        volumeSliderBottom.value = lastVolume;
    } else {
        lastVolume = audioPlayer.volume;
        audioPlayer.muted = true;
        audioPlayer.volume = 0;
    }
    updateVolumeIcon();
}

function updateProgress() {
    if (audioPlayer.duration) {
        const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressBarBottom.style.width = `${progressPercent}%`;
        currentTimeSpanBottom.textContent = formatTime(audioPlayer.currentTime);
    } else {
        currentTimeSpanBottom.textContent = '0:00';
        durationSpanBottom.textContent = '0:00';
        progressBarBottom.style.width = '0%';
    }
}

function setProgress(e) {
    const width = this.clientWidth;
    const clickX = e.offsetX;
    const duration = audioPlayer.duration;
    if (duration) {
        audioPlayer.currentTime = (clickX / width) * duration;
    }
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) {
        return '0:00';
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

async function addSongsToPlaylist(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    if (defaultSongElement) {
        defaultSongElement.remove();
        defaultSongElement = null;
    }

    let firstSongAddedToEmptyPlaylist = false;
    if (playlist.length === 0) {
        firstSongAddedToEmptyPlaylist = true;
    }

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type === 'audio/mpeg') {
            try {
                const id = await addSongToDB(file);
                const objectURL = URL.createObjectURL(file); 
                const song = {
                    id: id,
                    file: file,
                    url: objectURL, 
                    name: file.name.replace('.mp3', ''),
                    duration: '0:00'
                };
                playlist.push(song);
                addSongToQueueUI(song, playlist.length - 1);
            } catch (error) {
                console.error('Failed to add song to DB or create URL:', error);
                alert(`Nie udało się dodać pliku "${file.name}".`);
            }
        } else {
            console.warn(`Plik ${file.name} nie jest plikiem MP3 i zostanie pominięty.`);
        }
    }

    if (firstSongAddedToEmptyPlaylist && playlist.length > 0) {
        playSong(0);
    }
    fileInput.value = ''; 
}

function addSongToQueueUI(song, index) {
    const queueItem = document.createElement('div');
    queueItem.classList.add('queue-item');
    queueItem.dataset.index = index;
    if (song.id !== undefined) {
        queueItem.dataset.id = song.id;
    }

    queueItem.innerHTML = `
        <div class="song-icon"><i class="fas fa-music"></i></div>
        <div class="song-details">
            <div class="song-title">${song.name}</div>
            <div class="song-meta">Unkown...</div>
        </div>
        <div class="song-duration">${song.duration}</div>
    `;
    queueList.appendChild(queueItem);

    queueItem.addEventListener('click', () => {
        playSong(index);
    });
}

function playSong(index) {
    if (index < 0 || index >= playlist.length) {
        console.error('Indeks piosenki poza zakresem:', index);
        return;
    }

    document.querySelectorAll('.queue-item').forEach(item => {
        item.classList.remove('active-song');
    });

    const activeItem = document.querySelector(`.queue-item[data-index="${index}"]`);
    if (activeItem) {
        activeItem.classList.add('active-song');
    }

    currentSongIndex = index;
    const song = playlist[currentSongIndex];

    if (!song.url || !(song.file instanceof Blob)) { 
        console.error('Błąd: Piosenka nie ma prawidłowego URL lub pliku Blob:', song);
        songTitleBottom.textContent = 'Błąd odtwarzania (brak URL/pliku)';
        isPlaying = false;
        playPauseBtnBottom.innerHTML = '<i class="fas fa-play"></i>';
        return;
    }

    audioPlayer.src = song.url;
    audioPlayer.load(); 

    audioPlayer.play()
        .then(() => {
            isPlaying = true;
            playPauseBtnBottom.innerHTML = '<i class="fas fa-pause"></i>';
            songTitleBottom.textContent = song.name;
        })
        .catch(error => {
            console.error('Błąd podczas próby odtwarzania:', error);
            let errorMessage = 'Błąd odtwarzania';
            if (error.name === "NotAllowedError") {
                errorMessage = "Autoplay zablokowany przez przeglądarkę.";
                alert('Przeglądarka zablokowała automatyczne odtwarzanie. Spróbuj kliknąć przycisk Play.');
            } else if (error.name === "AbortError") {
                errorMessage = "Odtwarzanie przerwane (np. szybkie przełączanie).";
            } else if (error.name === "NotSupportedError") {
                 errorMessage = "Brak wsparcia formatu audio lub uszkodzony plik.";
            } else {
                errorMessage = `Błąd odtwarzania: ${error.message}`;
            }
            songTitleBottom.textContent = errorMessage;
            isPlaying = false;
            playPauseBtnBottom.innerHTML = '<i class="fas fa-play"></i>';
        });
}

function playNextSong() {
    if (playlist.length === 0) return;

    let nextIndex = currentSongIndex + 1;
    if (nextIndex >= playlist.length) {
        nextIndex = 0; 
    }
    playSong(nextIndex);
}

function playPreviousSong() {
    if (playlist.length === 0) return;

    let prevIndex = currentSongIndex - 1;
    if (prevIndex < 0) {
        prevIndex = playlist.length - 1; 
    }
    playSong(prevIndex);
}

function switchView(viewName) {
    document.querySelectorAll('.content-view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`${viewName}-view`).classList.add('active');
}

function setActiveNavLink(clickedLink) {
    document.querySelectorAll('.nav-list li').forEach(link => {
        link.classList.remove('active');
    });
    clickedLink.classList.add('active');
}

openDatabase()
    .then(() => {
        setVolume();
        updateVolumeIcon();
        if (playlist.length > 0 && currentSongIndex !== -1) {
            songTitleBottom.textContent = playlist[currentSongIndex].name;
            const activeItem = document.querySelector(`.queue-item[data-index="${currentSongIndex}"]`);
            if (activeItem) {
                activeItem.classList.add('active-song');
            }
        }
        switchView('home');
        setActiveNavLink(navHome);
    })
    .catch(error => console.error('Failed to initialize application:', error));
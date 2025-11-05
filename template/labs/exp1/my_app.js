// Earthquake Time Series Analyzer - Main Application

// Global state
let originalData = null;
let filteredData = null;
let sampleRate = null;
let timeArray = [];
let amplitudeArray = [];

// DOM Elements
const csvFileInput = document.getElementById('csvFile');
const uploadLabel = document.querySelector('.upload-label');
const uploadText = document.getElementById('uploadText');
const fileInfo = document.getElementById('fileInfo');
const emptyState = document.getElementById('emptyState');

const filterTypeSelect = document.getElementById('filterType');
const lowpassControls = document.getElementById('lowpassControls');
const highpassControls = document.getElementById('highpassControls');
const bandpassControls = document.getElementById('bandpassControls');

const lowpassCutoff = document.getElementById('lowpassCutoff');
const lowpassValue = document.getElementById('lowpassValue');
const highpassCutoff = document.getElementById('highpassCutoff');
const highpassValue = document.getElementById('highpassValue');
const bandpassLow = document.getElementById('bandpassLow');
const bandpassLowValue = document.getElementById('bandpassLowValue');
const bandpassHigh = document.getElementById('bandpassHigh');
const bandpassHighValue = document.getElementById('bandpassHighValue');
const filterOrder = document.getElementById('filterOrder');
const filterOrderValue = document.getElementById('filterOrderValue');

const applyFilterBtn = document.getElementById('applyFilter');
const resetFilterBtn = document.getElementById('resetFilter');
const downloadFilteredBtn = document.getElementById('downloadFiltered');
const dataInfoDiv = document.getElementById('dataInfo');
const spectrogramOverlap = document.getElementById('spectrogramOverlap');
const overlapValue = document.getElementById('overlapValue');

// ===============================
// EVENT LISTENERS
// ===============================

// File upload
csvFileInput.addEventListener('change', handleFileSelect);

// Drag and drop
uploadLabel.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadLabel.style.borderColor = 'var(--accent)';
});

uploadLabel.addEventListener('dragleave', () => {
    uploadLabel.style.borderColor = 'var(--border)';
});

uploadLabel.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadLabel.style.borderColor = 'var(--border)';
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// Filter type change
filterTypeSelect.addEventListener('change', () => {
    const filterType = filterTypeSelect.value;
    lowpassControls.style.display = filterType === 'lowpass' ? 'block' : 'none';
    highpassControls.style.display = filterType === 'highpass' ? 'block' : 'none';
    bandpassControls.style.display = filterType === 'bandpass' ? 'block' : 'none';
});

// Slider value updates
lowpassCutoff.addEventListener('input', () => {
    lowpassValue.textContent = parseFloat(lowpassCutoff.value).toFixed(1);
});

highpassCutoff.addEventListener('input', () => {
    highpassValue.textContent = parseFloat(highpassCutoff.value).toFixed(1);
});

bandpassLow.addEventListener('input', () => {
    bandpassLowValue.textContent = parseFloat(bandpassLow.value).toFixed(1);
});

bandpassHigh.addEventListener('input', () => {
    bandpassHighValue.textContent = parseFloat(bandpassHigh.value).toFixed(1);
});

filterOrder.addEventListener('input', () => {
    filterOrderValue.textContent = filterOrder.value;
});

// Filter buttons
applyFilterBtn.addEventListener('click', applyFilter);
resetFilterBtn.addEventListener('click', resetFilter);
downloadFilteredBtn.addEventListener('click', downloadFilteredCSV);

// Preset buttons
document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        applyPreset(preset);
    });
});

// Spectrogram overlap control
if (spectrogramOverlap) {
    // update displayed value initially
    overlapValue.textContent = parseFloat(spectrogramOverlap.value).toFixed(2);
    spectrogramOverlap.addEventListener('input', () => {
        overlapValue.textContent = parseFloat(spectrogramOverlap.value).toFixed(2);
        // re-plot spectrogram immediately with new overlap
        plotSpectrogram();
    });
}

// ===============================
// FILE HANDLING
// ===============================

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    if (!file.name.endsWith('.csv')) {
        alert('Please upload a CSV file');
        return;
    }

    uploadText.textContent = 'Loading...';

    Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
            processCSVData(results.data, file.name);
        },
        error: (error) => {
            alert('Error parsing CSV: ' + error.message);
            uploadText.textContent = 'Choose CSV File or Drop Here';
        }
    });
}

function processCSVData(data, filename) {
    if (!data || data.length < 2) {
        alert('CSV file must contain at least 2 rows of data');
        uploadText.textContent = 'Choose CSV File or Drop Here';
        return;
    }

    // Detect time and amplitude columns
    const headers = Object.keys(data[0]);
    let timeCol = null;
    let ampCol = null;
    let hasTimeColumn = false;

    // Look for time column
    const timeKeywords = ['time', 'timestamp', 't', 'date', 'datetime'];
    for (const header of headers) {
        if (timeKeywords.some(keyword => header.toLowerCase().includes(keyword))) {
            timeCol = header;
            hasTimeColumn = true;
            break;
        }
    }

    // Look for amplitude column
    const ampKeywords = ['amplitude', 'amp', 'value', 'signal', 'magnitude'];
    for (const header of headers) {
        if (ampKeywords.some(keyword => header.toLowerCase().includes(keyword))) {
            ampCol = header;
            break;
        }
    }

    // If no time column found, check if we have amplitude-only data
    if (!hasTimeColumn) {
        // Try to find amplitude column or use first numeric column
        if (!ampCol) {
            const numericCols = headers.filter(h => typeof data[0][h] === 'number');
            if (numericCols.length >= 1) {
                ampCol = numericCols[0];
            } else if (headers.length >= 1) {
                ampCol = headers[0];
            }
        }

        if (!ampCol) {
            alert('Could not detect amplitude column. Please ensure your CSV has data.');
            uploadText.textContent = 'Choose CSV File or Drop Here';
            return;
        }

        // Prompt user for sample rate
        const userSampleRate = prompt('No time column detected. Please enter the sample rate in Hz (e.g., 100 for 100 Hz):', '100');

        if (!userSampleRate) {
            uploadText.textContent = 'Choose CSV File or Drop Here';
            return;
        }

        sampleRate = parseFloat(userSampleRate);

        if (isNaN(sampleRate) || sampleRate <= 0) {
            alert('Invalid sample rate. Please enter a positive number.');
            uploadText.textContent = 'Choose CSV File or Drop Here';
            return;
        }

        // Extract amplitude data only
        amplitudeArray = [];
        for (const row of data) {
            const ampVal = row[ampCol];
            if (ampVal != null && !isNaN(ampVal)) {
                amplitudeArray.push(parseFloat(ampVal));
            }
        }

        if (amplitudeArray.length < 2) {
            alert('Not enough valid data points found (minimum 2 required)');
            uploadText.textContent = 'Choose CSV File or Drop Here';
            return;
        }

        // Generate time array based on sample rate
        timeArray = [];
        const dt = 1 / sampleRate;
        for (let i = 0; i < amplitudeArray.length; i++) {
            timeArray.push(i * dt);
        }

    } else {
        // Original logic for data with time column
        if (!ampCol) {
            const numericCols = headers.filter(h => typeof data[0][h] === 'number');
            if (numericCols.length >= 1 && numericCols[0] !== timeCol) {
                ampCol = numericCols[0];
            } else if (numericCols.length >= 2) {
                ampCol = numericCols[1];
            } else if (headers.length >= 2) {
                ampCol = headers[1];
            }
        }

        if (!ampCol) {
            alert('Could not detect amplitude column. Please ensure your CSV has proper headers.');
            uploadText.textContent = 'Choose CSV File or Drop Here';
            return;
        }

        // Extract data with time
        timeArray = [];
        amplitudeArray = [];

        for (const row of data) {
            const timeVal = row[timeCol];
            const ampVal = row[ampCol];

            if (timeVal != null && ampVal != null) {
                // Handle different time formats
                let timeMs = null;
                if (typeof timeVal === 'number') {
                    timeMs = timeVal;
                } else if (typeof timeVal === 'string') {
                    const parsed = Date.parse(timeVal);
                    if (!isNaN(parsed)) {
                        timeMs = parsed;
                    } else {
                        const num = parseFloat(timeVal);
                        if (!isNaN(num)) {
                            timeMs = num;
                        }
                    }
                }

                if (timeMs != null && !isNaN(ampVal)) {
                    timeArray.push(timeMs);
                    amplitudeArray.push(parseFloat(ampVal));
                }
            }
        }

        if (timeArray.length < 2) {
            alert('Not enough valid data points found (minimum 2 required)');
            uploadText.textContent = 'Choose CSV File or Drop Here';
            return;
        }

        // Calculate sample rate
        const timeDiffs = [];
        for (let i = 1; i < timeArray.length; i++) {
            timeDiffs.push(timeArray[i] - timeArray[i - 1]);
        }
        const avgTimeDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;

        // Convert to Hz (if time is in milliseconds, divide by 1000)
        if (avgTimeDiff > 100) { // Likely milliseconds
            sampleRate = 1000 / avgTimeDiff;
            // Normalize time to seconds
            timeArray = timeArray.map(t => t / 1000);
        } else { // Already in seconds
            sampleRate = 1 / avgTimeDiff;
        }
    }

    originalData = {
        time: [...timeArray],
        amplitude: [...amplitudeArray],
        filename: filename
    };

    filteredData = {
        time: [...timeArray],
        amplitude: [...amplitudeArray]
    };

    // Update UI
    uploadText.textContent = filename;
    fileInfo.classList.add('active');
    fileInfo.textContent = `Loaded ${timeArray.length} data points`;
    emptyState.classList.add('hidden');

    updateDataInfo();
    enableControls();
    plotTimeSeries();
    plotSpectrogram();
}

// ===============================
// PLOTTING FUNCTIONS
// ===============================

function plotTimeSeries() {
    const trace = {
        x: filteredData.time,
        y: filteredData.amplitude,
        type: 'scatter',
        mode: 'lines',
        name: 'Amplitude',
        line: {
            color: '#667eea',
            width: 1
        }
    };

    const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(255,255,255,0.02)',
        font: { color: '#1a1a1a', size: 14 },
        xaxis: {
            title: { text: 'Time (s)', font: { color: '#1a1a1a', size: 14 } },
            gridcolor: 'rgba(255,255,255,0.1)',
            zerolinecolor: 'rgba(255,255,255,0.2)',
            tickfont: { color: '#1a1a1a', size: 12 }
        },
        yaxis: {
            title: { text: 'Amplitude', font: { color: '#1a1a1a', size: 14 } },
            gridcolor: 'rgba(255,255,255,0.1)',
            zerolinecolor: 'rgba(255,255,255,0.2)',
            tickfont: { color: '#1a1a1a', size: 12 }
        },
        margin: { l: 60, r: 40, t: 20, b: 60 },
        hovermode: 'closest'
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d']
    };

    Plotly.newPlot('tsaPlot', [trace], layout, config);
}

function plotSpectrogram() {
    if (!filteredData || !Array.isArray(filteredData.amplitude)) return;

    const signal = filteredData.amplitude;
    const windowSize = 256;
    // Read overlap from UI if available (value between 0 and <1). Default to 0.5.
    let overlap = 0.5;
    if (typeof spectrogramOverlap !== 'undefined' && spectrogramOverlap !== null) {
        overlap = parseFloat(spectrogramOverlap.value);
        if (isNaN(overlap)) overlap = 0.5;
    }

    // Clamp overlap to sensible bounds [0, 0.99]
    const overlapClamped = Math.max(0, Math.min(0.99, overlap));
    const hop = Math.max(1, Math.floor(windowSize * (1 - overlapClamped)));

    // Compute STFT
    const numWindows = Math.max(0, Math.floor((signal.length - windowSize) / hop) + 1);
    const spectrogram = [];
    const frequencies = [];
    const times = [];

    // Calculate frequency bins
    for (let i = 0; i < windowSize / 2; i++) {
        frequencies.push((i * sampleRate) / windowSize);
    }

    // Process each window
    for (let i = 0; i < numWindows; i++) {
        const start = i * hop;
        const window = signal.slice(start, start + windowSize);

        if (window.length < windowSize) {
            // Pad with zeros
            while (window.length < windowSize) {
                window.push(0);
            }
        }

        // Apply Hamming window
        const hammingWindow = window.map((val, idx) => {
            const w = 0.54 - 0.46 * Math.cos(2 * Math.PI * idx / (windowSize - 1));
            return val * w;
        });

        // Compute FFT
        const fftResult = fft(hammingWindow);
        const magnitude = fftResult.slice(0, windowSize / 2).map(c =>
            20 * Math.log10(Math.sqrt(c.re * c.re + c.im * c.im) + 1e-10)
        );

        spectrogram.push(magnitude);
        times.push(filteredData.time[start]);
    }

    // Transpose for Plotly
    const zData = frequencies.map((_, freqIdx) =>
        spectrogram.map(window => window[freqIdx])
    );

    const trace = {
        x: times,
        y: frequencies,
        z: zData,
        type: 'heatmap',
        colorscale: 'Jet',
        colorbar: {
            title: 'Power (dB)',
            titleside: 'right',
            tickfont: { color: '#1a1a1a', size: 12 },
            titlefont: { color: '#1a1a1a', size: 14 }
        }
    };

    const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(255,255,255,0.02)',
        font: { color: '#1a1a1a', size: 14 },
        xaxis: {
            title: { text: 'Time (s)', font: { color: '#1a1a1a', size: 14 } },
            gridcolor: 'rgba(255,255,255,0.1)',
            tickfont: { color: '#1a1a1a', size: 12 }
        },
        yaxis: {
            title: { text: 'Frequency (Hz)', font: { color: '#1a1a1a', size: 14 } },
            gridcolor: 'rgba(255,255,255,0.1)',
            tickfont: { color: '#1a1a1a', size: 12 }
        },
        margin: { l: 60, r: 100, t: 20, b: 60 }
    };

    const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
    };

    Plotly.newPlot('spectrogramPlot', [trace], layout, config);
}

// ===============================
// FFT IMPLEMENTATION
// ===============================

function fft(input) {
    const n = input.length;

    // Pad to power of 2
    let paddedN = 1;
    while (paddedN < n) paddedN *= 2;

    const padded = new Array(paddedN).fill(0).map((_, i) => ({
        re: i < n ? input[i] : 0,
        im: 0
    }));

    return fftRecursive(padded);
}

function fftRecursive(x) {
    const n = x.length;

    if (n === 1) return x;

    // Divide
    const even = fftRecursive(x.filter((_, i) => i % 2 === 0));
    const odd = fftRecursive(x.filter((_, i) => i % 2 === 1));

    // Conquer
    const result = new Array(n);
    for (let k = 0; k < n / 2; k++) {
        const angle = -2 * Math.PI * k / n;
        const twiddle = { re: Math.cos(angle), im: Math.sin(angle) };

        const t = {
            re: twiddle.re * odd[k].re - twiddle.im * odd[k].im,
            im: twiddle.re * odd[k].im + twiddle.im * odd[k].re
        };

        result[k] = {
            re: even[k].re + t.re,
            im: even[k].im + t.im
        };

        result[k + n / 2] = {
            re: even[k].re - t.re,
            im: even[k].im - t.im
        };
    }

    return result;
}

// ===============================
// FILTER IMPLEMENTATION
// ===============================

function applyFilter() {
    if (!originalData) return;

    const filterType = filterTypeSelect.value;

    if (filterType === 'none') {
        resetFilter();
        return;
    }

    let cutoffLow, cutoffHigh;
    const order = parseInt(filterOrder.value);

    switch (filterType) {
        case 'lowpass':
            cutoffLow = parseFloat(lowpassCutoff.value);
            filteredData.amplitude = butterworthLowpass(originalData.amplitude, cutoffLow, sampleRate, order);
            break;
        case 'highpass':
            cutoffHigh = parseFloat(highpassCutoff.value);
            filteredData.amplitude = butterworthHighpass(originalData.amplitude, cutoffHigh, sampleRate, order);
            break;
        case 'bandpass':
            cutoffLow = parseFloat(bandpassLow.value);
            cutoffHigh = parseFloat(bandpassHigh.value);
            if (cutoffLow >= cutoffHigh) {
                alert('Low cutoff must be less than high cutoff');
                return;
            }
            filteredData.amplitude = butterworthBandpass(originalData.amplitude, cutoffLow, cutoffHigh, sampleRate, order);
            break;
    }

    plotTimeSeries();
    plotSpectrogram();
}

function resetFilter() {
    if (!originalData) return;

    filteredData.amplitude = [...originalData.amplitude];
    filterTypeSelect.value = 'none';
    lowpassControls.style.display = 'none';
    highpassControls.style.display = 'none';
    bandpassControls.style.display = 'none';

    plotTimeSeries();
    plotSpectrogram();
}

// Butterworth filter implementations (simplified using frequency domain)
function butterworthLowpass(signal, cutoff, fs, order) {
    return frequencyDomainFilter(signal, fs, (freq) => {
        const ratio = freq / cutoff;
        return 1 / Math.sqrt(1 + Math.pow(ratio, 2 * order));
    });
}

function butterworthHighpass(signal, cutoff, fs, order) {
    return frequencyDomainFilter(signal, fs, (freq) => {
        if (freq === 0) return 0;
        const ratio = cutoff / freq;
        return 1 / Math.sqrt(1 + Math.pow(ratio, 2 * order));
    });
}

function butterworthBandpass(signal, lowCutoff, highCutoff, fs, order) {
    return frequencyDomainFilter(signal, fs, (freq) => {
        if (freq < lowCutoff || freq > highCutoff) {
            const ratioLow = freq / lowCutoff;
            const ratioHigh = highCutoff / freq;
            return 1 / Math.sqrt((1 + Math.pow(1/ratioLow, 2 * order)) * (1 + Math.pow(1/ratioHigh, 2 * order)));
        }
        return 1;
    });
}

function frequencyDomainFilter(signal, fs, filterFunc) {
    const n = signal.length;

    // Forward FFT
    const fftResult = fft(signal);

    // Apply filter in frequency domain
    const filtered = fftResult.map((complex, i) => {
        const freq = (i * fs) / fftResult.length;
        const gain = filterFunc(freq);
        return {
            re: complex.re * gain,
            im: complex.im * gain
        };
    });

    // Inverse FFT
    const ifftResult = ifft(filtered);

    // Return real part, trimmed to original length
    return ifftResult.slice(0, n).map(c => c.re);
}

function ifft(x) {
    // Conjugate
    const conj = x.map(c => ({ re: c.re, im: -c.im }));

    // Forward FFT
    const result = fftRecursive(conj);

    // Conjugate and normalize
    const n = x.length;
    return result.map(c => ({ re: c.re / n, im: -c.im / n }));
}

// ===============================
// PRESET FILTERS
// ===============================

function applyPreset(preset) {
    if (!originalData) return;

    filterTypeSelect.value = 'bandpass';
    bandpassControls.style.display = 'block';
    lowpassControls.style.display = 'none';
    highpassControls.style.display = 'none';

    switch (preset) {
        case 'earthquake':
            bandpassLow.value = 0.5;
            bandpassHigh.value = 5;
            break;
        case 'microseismic':
            bandpassLow.value = 1;
            bandpassHigh.value = 10;
            break;
        case 'teleseismic':
            bandpassLow.value = 0.01;
            bandpassHigh.value = 1;
            break;
    }

    bandpassLowValue.textContent = parseFloat(bandpassLow.value).toFixed(2);
    bandpassHighValue.textContent = parseFloat(bandpassHigh.value).toFixed(2);

    applyFilter();
}

// ===============================
// CSV DOWNLOAD
// ===============================

function downloadFilteredCSV() {
    if (!filteredData) return;

    let csvContent = 'time,amplitude\n';
    for (let i = 0; i < filteredData.time.length; i++) {
        csvContent += `${filteredData.time[i]},${filteredData.amplitude[i]}\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filtered_earthquake_data.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ===============================
// UI HELPER FUNCTIONS
// ===============================

function enableControls() {
    applyFilterBtn.disabled = false;
    resetFilterBtn.disabled = false;
    downloadFilteredBtn.disabled = false;
}

function updateDataInfo() {
    if (!originalData) return;

    const duration = timeArray[timeArray.length - 1] - timeArray[0];
    const maxAmp = Math.max(...amplitudeArray);
    const minAmp = Math.min(...amplitudeArray);

    dataInfoDiv.innerHTML = `
        <p><strong>File:</strong> ${originalData.filename}</p>
        <p><strong>Points:</strong> ${timeArray.length}</p>
        <p><strong>Duration:</strong> ${duration.toFixed(2)} s</p>
        <p><strong>Sample Rate:</strong> ${sampleRate.toFixed(2)} Hz</p>
        <p><strong>Amplitude Range:</strong> ${minAmp.toFixed(3)} to ${maxAmp.toFixed(3)}</p>
    `;
}
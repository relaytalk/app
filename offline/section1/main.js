// section1/main.js
document.addEventListener('DOMContentLoaded', function() {
    const shayariText = document.getElementById('shayari-text');
    const shayariTheme = document.getElementById('shayari-theme');
    const currentShayari = document.getElementById('current-shayari');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const progressBar = document.getElementById('progress-bar');
    const progressDots = document.getElementById('progress-dots');
    const restartScreen = document.getElementById('restart-screen');
    const restartBtn = document.getElementById('restart-btn');
    
    let currentIndex = 0;
    
    // Initialize progress dots
    function initProgressDots() {
        progressDots.innerHTML = '';
        for (let i = 0; i < shayaris.length; i++) {
            const dot = document.createElement('div');
            dot.className = 'progress-dot';
            dot.style.width = '16px';
            dot.style.height = '16px';
            dot.style.backgroundColor = i === currentIndex ? '#ff7e5f' : '#ffe0d6';
            dot.style.borderRadius = '50%';
            dot.style.display = 'inline-block';
            dot.style.margin = '0 5px';
            dot.style.transition = 'background-color 0.3s';
            progressDots.appendChild(dot);
        }
    }
    
    // Update the display
    function updateDisplay() {
        const shayari = shayaris[currentIndex];
        shayariText.innerHTML = shayari.text;
        shayariTheme.textContent = shayari.theme;
        currentShayari.textContent = shayari.id;
        
        // Update progress bar
        const progressPercentage = ((currentIndex + 1) / shayaris.length) * 100;
        progressBar.style.width = `${progressPercentage}%`;
        
        // Update progress dots
        const dots = progressDots.querySelectorAll('.progress-dot');
        dots.forEach((dot, index) => {
            dot.style.backgroundColor = index === currentIndex ? '#ff7e5f' : 
                                        index < currentIndex ? '#feb47b' : '#ffe0d6';
        });
        
        // Update button states
        prevBtn.disabled = currentIndex === 0;
        prevBtn.style.opacity = currentIndex === 0 ? '0.5' : '1';
        
        // Check if we're at the last shayari
        if (currentIndex === shayaris.length - 1) {
            nextBtn.innerHTML = 'Finish <span class="btn-icon">✓</span>';
        } else {
            nextBtn.innerHTML = 'Next <span class="btn-icon">→</span>';
        }
        
        // Show/hide restart screen
        if (currentIndex === shayaris.length - 1) {
            setTimeout(() => {
                restartScreen.style.display = 'block';
            }, 300);
        } else {
            restartScreen.style.display = 'none';
        }
    }
    
    // Next button click
    nextBtn.addEventListener('click', function() {
        if (currentIndex < shayaris.length - 1) {
            currentIndex++;
            updateDisplay();
        } else {
            // Already at the end, show restart screen
            restartScreen.style.display = 'block';
        }
    });
    
    // Previous button click
    prevBtn.addEventListener('click', function() {
        if (currentIndex > 0) {
            currentIndex--;
            updateDisplay();
        }
    });
    
    // Restart button click
    restartBtn.addEventListener('click', function() {
        currentIndex = 0;
        updateDisplay();
        restartScreen.style.display = 'none';
    });
    
    // Initialize
    initProgressDots();
    updateDisplay();
    
    // Add keyboard navigation
    document.addEventListener('keydown', function(event) {
        if (event.key === 'ArrowRight' || event.key === ' ') {
            // Next with right arrow or space
            if (currentIndex < shayaris.length - 1) {
                currentIndex++;
                updateDisplay();
            }
        } else if (event.key === 'ArrowLeft') {
            // Previous with left arrow
            if (currentIndex > 0) {
                currentIndex--;
                updateDisplay();
            }
        }
    });
});
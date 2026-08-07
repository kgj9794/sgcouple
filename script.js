// ⚠️ 배포한 Google Apps Script Web App URL을 여기에 넣으세요.
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzDQCQbrwOX9F_Kx2uf_fg4tBTyslIdWFd_CDIHSS98O79V42Mia94KYT9hpWzTY0K7Fw/exec";

// ImgBB API Key
const IMGBB_API_KEY = "1e05b643dab984322bd28f66c40c0729";

// BGM 음원 목록
const BGM_PLAYLIST = [
    "https://maplemusic.o-r.kr/%EB%85%B8%EB%9E%98/%E1%84%8B%E1%85%A6%E1%84%8B%E1%85%AE%E1%84%85%E1%85%A6%E1%86%AF.mp3"
];

let dbData = {};
let targetWeddingDate = null;
let verifiedAdminPassword = "";
let activeModalStack = [];

let galleryUrls = [];
let adminGalleryUrls = [];
let currentGalleryIndex = 0;
let isLightboxAnimating = false;
let isGalleryExpanded = false;

let toastTimeout = null;
let adminPressTimer = null;
let bgmAudio = null;
let isBgmPlaying = false;
let bgmQueue = [];        
let bgmIndex = 0;         
let fireworksAnimationId = null;
let scrollPosition = 0;
let hasShownInitialBgmToast = false;
let currentStoryPage = 1; 
let heartsInterval = null; 

// 라이트박스 터치 드래그 변수
let isLightboxDragging = false;
let touchStartX = 0;
let touchCurrentX = 0;

// 관리자 갤러리 터치 드래그 변수
let touchDragIndex = null;

let prevValues = {
    days: '',
    hours: '',
    mins: '',
    secs: ''
};

const UNLOCK_EVENTS = ['click', 'touchstart', 'touchend', 'touchmove', 'scroll', 'wheel', 'pointerdown', 'keydown'];

document.addEventListener('DOMContentLoaded', async () => {
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('dragstart', (e) => e.preventDefault());

    initBgm();
    initFireworks();
    const typingPromise = startTypingAnimation();
    initAdminLongPress();
    initSakura();
    initLightboxTouch();

    const minIntroDelay = new Promise(resolve => setTimeout(resolve, 3000));

    try {
        await Promise.all([fetchDBData(), minIntroDelay, typingPromise]);
    } catch (err) {
        console.error("초기 데이터 로딩 중 오류 발생:", err);
    } finally {
        hideIntroOverlay();
    }

    setTimeout(() => {
        const scrollIndicator = document.getElementById('scroll-indicator');
        if (scrollIndicator) {
            scrollIndicator.classList.add('show');
        }
    }, 5000);

    const observerOptions = {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
    };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    window.addEventListener('popstate', () => {
        if (activeModalStack.length > 0) {
            const topModalId = activeModalStack[activeModalStack.length - 1];
            closeModal(topModalId, true);
        }
    });

    window.addEventListener('keydown', (e) => {
        const lightboxModal = document.getElementById('gallery-lightbox-modal');
        if (lightboxModal && lightboxModal.style.display === 'flex') {
            if (e.key === 'ArrowLeft') navigateLightbox(-1);
            if (e.key === 'ArrowRight') navigateLightbox(1);
            if (e.key === 'Escape') closeModal('gallery-lightbox-modal');
        }
    });

    setInterval(updateCountdown, 1000);
});

// --- 인트로 타이핑 애니메이션 ---
async function startTypingAnimation() {
    const titleEl = document.getElementById('typing-title');
    const subEl = document.getElementById('typing-sub');
    if (!titleEl || !subEl) return;

    titleEl.textContent = '';
    subEl.textContent = '';
    titleEl.classList.remove('done');
    subEl.classList.remove('done');

    const text1 = "소중한 여러분을 초대합니다.";

    for (let i = 0; i < text1.length; i++) {
        titleEl.textContent += text1[i];
        await new Promise(resolve => setTimeout(resolve, 75));
    }

    titleEl.classList.add('done');
    await new Promise(resolve => setTimeout(resolve, 180));

    const groom = dbData.groom_name || '건주';
    const bride = dbData.bride_name || '수아';
    const text2 = `From ${groom}와 ${bride}`;

    for (let i = 0; i < text2.length; i++) {
        subEl.textContent += text2[i];
        await new Promise(resolve => setTimeout(resolve, 75));
    }

    await new Promise(resolve => setTimeout(resolve, 350));
    subEl.classList.add('done');
}

// --- BGM 제어 ---
function shuffleBgmPlaylist() {
    bgmQueue = [...BGM_PLAYLIST];
    for (let i = bgmQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bgmQueue[i], bgmQueue[j]] = [bgmQueue[j], bgmQueue[i]];
    }
    bgmIndex = 0;
}

function loadBgmTrack() {
    if (!bgmAudio || bgmQueue.length === 0) return;
    bgmAudio.src = bgmQueue[bgmIndex];
    bgmAudio.load();
}

function playNextBgmTrack() {
    bgmIndex++;
    if (bgmIndex >= bgmQueue.length) {
        shuffleBgmPlaylist();
    }
    loadBgmTrack();
    if (isBgmPlaying) {
        bgmAudio.play().catch(err => console.error("연속 재생 오류:", err));
    }
}

function initBgm() {
    bgmAudio = document.getElementById('bgm-player');
    if (!bgmAudio) return;

    bgmAudio.volume = 0.6;
    shuffleBgmPlaylist();
    loadBgmTrack();

    bgmAudio.addEventListener('ended', playNextBgmTrack);
    bgmAudio.onerror = () => {
        if (bgmQueue.length > 1) {
            bgmQueue.splice(bgmIndex, 1);
            if (bgmIndex >= bgmQueue.length) bgmIndex = 0;
            loadBgmTrack();
            if (isBgmPlaying) bgmAudio.play().catch(() => {});
        }
    };

    startAudio();

    UNLOCK_EVENTS.forEach(evt => {
        window.addEventListener(evt, unlockInteraction, { passive: true });
    });
}

function removeUnlockListeners() {
    UNLOCK_EVENTS.forEach(evt => {
        window.removeEventListener(evt, unlockInteraction);
    });
}

function unlockInteraction(e) {
    if (e && e.target && e.target.closest('#bgm-btn')) {
        removeUnlockListeners();
        return;
    }
    startAudio();
    if (isBgmPlaying) {
        removeUnlockListeners();
    }
}

function startAudio() {
    if (bgmAudio && !isBgmPlaying) {
        bgmAudio.muted = false;
        bgmAudio.play().then(() => {
            isBgmPlaying = true;
            updateBgmBtnUI(true);
            
            if (!hasShownInitialBgmToast) {
                hasShownInitialBgmToast = true;
                showToast('배경음악이 재생됩니다.');
            }
        }).catch(() => {});
    }
}

function toggleBgm() {
    if (!bgmAudio) return;

    removeUnlockListeners();

    if (bgmAudio.paused || bgmAudio.muted) {
        bgmAudio.muted = false;
        bgmAudio.play().then(() => {
            isBgmPlaying = true;
            updateBgmBtnUI(true);
            showToast('음악이 켜졌습니다');
            hasShownInitialBgmToast = true;
        }).catch(err => console.error("음악 재생 실패:", err));
    } else {
        bgmAudio.muted = true;
        bgmAudio.pause();
        isBgmPlaying = false;
        updateBgmBtnUI(false);
        showToast('음악이 음소거되었습니다');
        hasShownInitialBgmToast = true;
    }
}

function updateBgmBtnUI(isPlaying) {
    const bgmBtn = document.getElementById('bgm-btn');
    if (bgmBtn) {
        bgmBtn.innerText = isPlaying ? '🎵' : '🔇';
    }
}

// --- 스토리 이미지 사전 로딩 ---
function preloadStoryImages(data) {
    if (!data) return;
    const urlsToPreload = [];

    if (data.story_cover_img) urlsToPreload.push(data.story_cover_img);
    if (data.hero_img) urlsToPreload.push(data.hero_img);

    for (let i = 1; i <= 5; i++) {
        if (data[`story_img_${i}`]) {
            urlsToPreload.push(data[`story_img_${i}`]);
        }
    }

    urlsToPreload.forEach(url => {
        if (url) {
            const img = new Image();
            img.src = url;
        }
    });
}

function startStoryInline() {
    const coverView = document.getElementById('story-cover-view');
    const inlineView = document.getElementById('story-inline-view');
    const storySection = document.querySelector('.story-section');

    if (coverView && inlineView) {
        coverView.style.display = 'none';
        inlineView.style.display = 'flex';
        currentStoryPage = 1;
        renderStoryPage(currentStoryPage);

        if (storySection) {
            storySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
}

function showStoryCover() {
    const coverView = document.getElementById('story-cover-view');
    const inlineView = document.getElementById('story-inline-view');
    const storySection = document.querySelector('.story-section');
    const storyScrollIndicator = document.querySelector('.story-scroll-indicator');

    if (storySection) storySection.classList.remove('pink-bg');
    if (storyScrollIndicator) storyScrollIndicator.classList.remove('show');
    stopFloatingHearts();

    if (coverView && inlineView) {
        inlineView.style.display = 'none';
        coverView.style.display = 'flex';
    }
}

function renderStoryPage(page) {
    const indicatorEl = document.getElementById('story-page-indicator');
    const imgEl = document.getElementById('story-display-img');
    const titleEl = document.getElementById('story-display-title');
    const descEl = document.getElementById('story-display-desc');
    const prevBtn = document.getElementById('story-prev-btn');
    const nextBtn = document.getElementById('story-next-btn');
    const storySection = document.querySelector('.story-section');
    const storyScrollIndicator = document.querySelector('.story-scroll-indicator');

    if (storySection) {
        if (page === 5) {
            storySection.classList.add('pink-bg');
            startFloatingHearts();
            if (storyScrollIndicator) storyScrollIndicator.classList.add('show');
        } else {
            storySection.classList.remove('pink-bg');
            stopFloatingHearts();
            if (storyScrollIndicator) storyScrollIndicator.classList.remove('show');
        }
    }

    if (indicatorEl) {
        const pageStr = String(page).padStart(2, '0');
        indicatorEl.innerText = `${pageStr}  /  05`;
    }

    const defaultTitles = ["첫 만남", "관계가 이어졌습니다", "함께한 특별한 날", "언제나 서로의 편", "약속, 그리고 새로운 시작"];
    const defaultDescs = [
        "처음 서로를 마주했던 그날의 설렘을 기억합니다.",
        "특별한 선언 없이\n그렇게, 함께가 되었습니다.",
        "계절이 바뀔 때마다 함께 차곡차곡 쌓아온 소중한 추억들.",
        "기쁠 때나 힘들 때나 언제나 서로의 든든한 버팀목이 되어주었습니다.",
        "이제 서로의 손을 꼭 잡고 평생을 함께 걸어가고자 합니다."
    ];

    const imgSrc = dbData[`story_img_${page}`] || dbData.hero_img || '';
    const titleText = dbData[`story_title_${page}`] || defaultTitles[page - 1];
    const descText = dbData[`story_desc_${page}`] || defaultDescs[page - 1];

    if (imgEl) imgEl.src = imgSrc;
    if (titleEl) titleEl.innerText = titleText;
    if (descEl) descEl.innerText = descText;

    if (prevBtn) prevBtn.disabled = false;
    if (nextBtn) nextBtn.disabled = (page === 5);
}

function startFloatingHearts() {
    stopFloatingHearts();
    const container = document.getElementById('story-hearts-container');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < 10; i++) {
        createSingleHeart(container, true);
    }

    heartsInterval = setInterval(() => {
        createSingleHeart(container, false);
    }, 450);
}

function stopFloatingHearts() {
    if (heartsInterval) {
        clearInterval(heartsInterval);
        heartsInterval = null;
    }
    const container = document.getElementById('story-hearts-container');
    if (container) container.innerHTML = '';
}

function createSingleHeart(container, isInitial) {
    if (!container) return;
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.innerText = Math.random() > 0.35 ? '♥' : '💕';

    const size = Math.random() * 1.0 + 0.8;
    const left = Math.random() * 90 + 5;
    const duration = Math.random() * 2.5 + 3.5;
    const delay = isInitial ? Math.random() * 2 : 0;

    heart.style.cssText = `
        left: ${left}%;
        font-size: ${size}rem;
        animation-duration: ${duration}s;
        animation-delay: ${delay}s;
    `;

    container.appendChild(heart);

    setTimeout(() => {
        if (heart.parentNode === container) {
            container.removeChild(heart);
        }
    }, (duration + delay) * 1000);
}

function animateStorySlide(direction, callback) {
    const card = document.getElementById('story-page-card');
    if (!card) {
        callback();
        return;
    }

    const outClass = direction === 'next' ? 'slide-out-left' : 'slide-out-right';
    const inClass = direction === 'next' ? 'slide-in-right' : 'slide-in-left';

    card.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');
    card.classList.add(outClass);

    setTimeout(() => {
        callback();
        card.classList.remove(outClass);
        void card.offsetWidth;
        card.classList.add(inClass);

        setTimeout(() => {
            card.classList.remove(inClass);
        }, 250);
    }, 200);
}

function prevStoryPage() {
    if (currentStoryPage === 1) {
        showStoryCover();
    } else if (currentStoryPage > 1) {
        animateStorySlide('prev', () => {
            currentStoryPage--;
            renderStoryPage(currentStoryPage);
        });
    }
}

function nextStoryPage() {
    if (currentStoryPage < 5) {
        animateStorySlide('next', () => {
            currentStoryPage++;
            renderStoryPage(currentStoryPage);
        });
    }
}

// --- 웨딩 갤러리 렌더링 & 더보기/접기 토글 ---
function renderGalleryGrid(urls) {
    const container = document.getElementById('gallery-grid');
    const btnContainer = document.getElementById('gallery-more-btn-container');
    if (!container) return;
    container.innerHTML = '';

    if (!urls || urls.length === 0) {
        container.innerHTML = '<p class="gallery-empty-text">등록된 사진이 없습니다.</p>';
        if (btnContainer) btnContainer.style.display = 'none';
        return;
    }

    galleryUrls = urls;
    isGalleryExpanded = false;

    const fragment = document.createDocumentFragment();

    urls.forEach((url, idx) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        if (idx >= 6) {
            item.classList.add('hidden-item');
        }
        item.onclick = () => openLightbox(idx);

        const img = document.createElement('img');
        img.src = url;
        img.alt = `웨딩 갤러리 사진 ${idx + 1}`;
        img.loading = 'lazy';
        img.setAttribute('decoding', 'async');
        img.oncontextmenu = () => false;
        img.ondragstart = () => false;

        item.appendChild(img);
        fragment.appendChild(item);
    });

    container.appendChild(fragment);

    if (btnContainer) {
        if (urls.length > 6) {
            btnContainer.style.display = 'flex';
            updateGalleryMoreBtnUI(false);
        } else {
            btnContainer.style.display = 'none';
        }
    }
}

function toggleGalleryExpand() {
    isGalleryExpanded = !isGalleryExpanded;

    const items = document.querySelectorAll('#gallery-grid .gallery-item');
    items.forEach((item, idx) => {
        if (idx >= 6) {
            if (isGalleryExpanded) {
                item.classList.remove('hidden-item');
            } else {
                item.classList.add('hidden-item');
            }
        }
    });

    updateGalleryMoreBtnUI(isGalleryExpanded);

    if (!isGalleryExpanded) {
        const gallerySec = document.querySelector('.gallery-section');
        if (gallerySec) {
            gallerySec.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

function updateGalleryMoreBtnUI(expanded) {
    const icon = document.getElementById('gallery-more-icon');
    const text = document.getElementById('gallery-more-text');

    if (expanded) {
        if (icon) icon.innerHTML = '<polyline points="18 15 12 9 6 15"></polyline>';
        if (text) text.innerText = '접기';
    } else {
        if (icon) icon.innerHTML = '<polyline points="6 9 12 15 18 9"></polyline>';
        if (text) text.innerText = '더 보기';
    }
}

function openLightbox(index) {
    if (!galleryUrls || galleryUrls.length === 0) return;

    currentGalleryIndex = index;
    const imgEl = document.getElementById('lightbox-img');
    if (imgEl) {
        imgEl.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');
        imgEl.style.transform = '';
        imgEl.style.opacity = '';
        imgEl.style.transition = '';
        imgEl.src = galleryUrls[currentGalleryIndex];
    }
    const counterEl = document.getElementById('lightbox-counter');
    if (counterEl) {
        counterEl.innerText = `${currentGalleryIndex + 1} / ${galleryUrls.length}`;
    }

    openModal('gallery-lightbox-modal');
}

function navigateLightbox(direction) {
    if (!galleryUrls || galleryUrls.length === 0 || isLightboxAnimating) return;

    const imgEl = document.getElementById('lightbox-img');
    if (!imgEl) return;

    isLightboxAnimating = true;

    const outClass = direction > 0 ? 'slide-out-left' : 'slide-out-right';
    const inClass = direction > 0 ? 'slide-in-right' : 'slide-in-left';

    imgEl.style.transform = '';
    imgEl.style.opacity = '';
    imgEl.style.transition = '';
    imgEl.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');
    imgEl.classList.add(outClass);

    setTimeout(() => {
        currentGalleryIndex += direction;
        if (currentGalleryIndex < 0) {
            currentGalleryIndex = galleryUrls.length - 1;
        } else if (currentGalleryIndex >= galleryUrls.length) {
            currentGalleryIndex = 0;
        }

        imgEl.src = galleryUrls[currentGalleryIndex];
        const counterEl = document.getElementById('lightbox-counter');
        if (counterEl) {
            counterEl.innerText = `${currentGalleryIndex + 1} / ${galleryUrls.length}`;
        }

        imgEl.classList.remove(outClass);
        void imgEl.offsetWidth;
        imgEl.classList.add(inClass);

        setTimeout(() => {
            imgEl.classList.remove(inClass);
            isLightboxAnimating = false;
        }, 250);
    }, 200);
}

// --- 실시간 터치 드래그 및 슬라이드 스와이프 이펙트 ---
function initLightboxTouch() {
    const wrapper = document.getElementById('lightbox-img-wrapper');
    const imgEl = document.getElementById('lightbox-img');
    if (!wrapper || !imgEl) return;

    wrapper.addEventListener('touchstart', (e) => {
        if (isLightboxAnimating || !galleryUrls || galleryUrls.length <= 1) return;
        touchStartX = e.touches[0].clientX;
        touchCurrentX = touchStartX;
        isLightboxDragging = true;
        imgEl.style.transition = 'none';
    }, { passive: true });

    wrapper.addEventListener('touchmove', (e) => {
        if (!isLightboxDragging) return;
        touchCurrentX = e.touches[0].clientX;
        const diffX = touchCurrentX - touchStartX;
        const opacity = Math.max(0.3, 1 - Math.abs(diffX) / 400);
        imgEl.style.transform = `translateX(${diffX}px) scale(${1 - Math.abs(diffX) / 2000})`;
        imgEl.style.opacity = opacity;
    }, { passive: true });

    wrapper.addEventListener('touchend', () => {
        if (!isLightboxDragging) return;
        isLightboxDragging = false;
        const diffX = touchCurrentX - touchStartX;

        imgEl.style.transition = 'transform 0.22s ease, opacity 0.22s ease';

        if (diffX < -50) {
            // 왼쪽으로 스와이프 -> 다음 이미지
            imgEl.style.transform = `translateX(-100%)`;
            imgEl.style.opacity = '0';
            setTimeout(() => {
                navigateLightboxAfterSwipe(1);
            }, 180);
        } else if (diffX > 50) {
            // 오른쪽으로 스와이프 -> 이전 이미지
            imgEl.style.transform = `translateX(100%)`;
            imgEl.style.opacity = '0';
            setTimeout(() => {
                navigateLightboxAfterSwipe(-1);
            }, 180);
        } else {
            // 위치 원복
            imgEl.style.transform = 'translateX(0) scale(1)';
            imgEl.style.opacity = '1';
            setTimeout(() => {
                imgEl.style.transition = '';
            }, 220);
        }
    });
}

function navigateLightboxAfterSwipe(direction) {
    const imgEl = document.getElementById('lightbox-img');
    if (!imgEl) return;

    currentGalleryIndex += direction;
    if (currentGalleryIndex < 0) {
        currentGalleryIndex = galleryUrls.length - 1;
    } else if (currentGalleryIndex >= galleryUrls.length) {
        currentGalleryIndex = 0;
    }

    imgEl.src = galleryUrls[currentGalleryIndex];
    const counterEl = document.getElementById('lightbox-counter');
    if (counterEl) {
        counterEl.innerText = `${currentGalleryIndex + 1} / ${galleryUrls.length}`;
    }

    const startPos = direction > 0 ? '100%' : '-100%';
    imgEl.style.transition = 'none';
    imgEl.style.transform = `translateX(${startPos})`;
    imgEl.style.opacity = '0';

    void imgEl.offsetWidth; // 강제 리플로우

    imgEl.style.transition = 'transform 0.25s cubic-bezier(0.215, 0.61, 0.355, 1), opacity 0.25s cubic-bezier(0.215, 0.61, 0.355, 1)';
    imgEl.style.transform = 'translateX(0)';
    imgEl.style.opacity = '1';

    setTimeout(() => {
        imgEl.style.transition = '';
        imgEl.style.transform = '';
        imgEl.style.opacity = '';
    }, 260);
}

// --- 약도 이미지 모달 및 내비게이션 연결 ---
function openMapImageModal() {
    const imgEl = document.getElementById('map-modal-img');
    if (imgEl) {
        const url = dbData.map_image_url || '';
        if (!url) {
            showToast('등록된 약도 이미지가 없습니다.');
            return;
        }
        imgEl.src = url;
    }
    openModal('map-image-modal');
}

function openNavApp(type) {
    const keyword = dbData.map_search_keyword || dbData.wedding_venue || '';
    if (!keyword) {
        showToast('등록된 검색어가 없습니다.');
        return;
    }

    const encoded = encodeURIComponent(keyword);
    let targetUrl = '';

    if (type === 'naver') {
        targetUrl = `https://m.map.naver.com/search2/search.naver?query=${encoded}`;
    } else if (type === 'tmap') {
        targetUrl = `https://tmap.co.kr/tmap2/mobile/route.jsp?name=${encoded}`;
    } else if (type === 'kakao') {
        targetUrl = `https://map.kakao.com/link/search/${encoded}`;
    }

    if (targetUrl) {
        window.open(targetUrl, '_blank');
    }
}

// --- ImgBB 업로드 & 썸네일 리스트 ---
async function uploadGalleryImagesToImgBB(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const statusEl = document.getElementById('admin-upload-status');
    if (statusEl) statusEl.innerText = `업로드 중... (0 / ${files.length})`;

    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: 'POST',
                body: formData
            });
            const json = await res.json();

            if (json.success && json.data && json.data.url) {
                adminGalleryUrls.push(json.data.url);
                successCount++;
                if (statusEl) statusEl.innerText = `업로드 중... (${successCount} / ${files.length})`;
            } else {
                alert(`업로드 실패: ${file.name}`);
            }
        } catch (err) {
            console.error("ImgBB 업로드 오류:", err);
            alert(`업로드 중 오류 발생: ${file.name}`);
        }
    }

    if (statusEl) statusEl.innerText = '업로드 완료!';
    setTimeout(() => { if (statusEl) statusEl.innerText = ''; }, 2000);

    event.target.value = '';
    renderAdminGalleryList();
}

function renderAdminGalleryList() {
    const container = document.getElementById('admin-gallery-list');
    if (!container) return;
    container.innerHTML = '';

    if (!adminGalleryUrls || adminGalleryUrls.length === 0) {
        container.innerHTML = '<p style="font-size:0.8rem; color:#888; padding:10px;">등록된 사진이 없습니다.</p>';
        return;
    }

    adminGalleryUrls.forEach((url, idx) => {
        const item = document.createElement('div');
        item.className = 'admin-gallery-thumb';
        item.dataset.index = idx;

        item.innerHTML = `
            <img src="${url}" alt="갤러리 썸네일 ${idx + 1}" oncontextmenu="return false;">
            <span class="thumb-idx">${idx + 1}</span>
            <button type="button" class="btn-thumb-del" onclick="removeAdminGalleryImg(${idx})" aria-label="삭제">&times;</button>
        `;

        item.draggable = true;
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', idx);
            item.classList.add('dragging');
        });

        item.addEventListener('dragover', (e) => { e.preventDefault(); });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
            if (!isNaN(fromIdx) && fromIdx !== idx) {
                const moved = adminGalleryUrls.splice(fromIdx, 1)[0];
                adminGalleryUrls.splice(idx, 0, moved);
                renderAdminGalleryList();
            }
        });

        item.addEventListener('dragend', () => { item.classList.remove('dragging'); });

        let touchTimer = null;

        item.addEventListener('touchstart', (e) => {
            if (e.target.tagName === 'BUTTON') return;

            touchTimer = setTimeout(() => {
                touchDragIndex = idx;
                item.classList.add('dragging');
                if (navigator.vibrate) navigator.vibrate(40);
                showToast('위치를 이동해 순서를 변경하세요.');
            }, 300);
        }, { passive: true });

        item.addEventListener('touchmove', (e) => {
            if (touchDragIndex === null) {
                clearTimeout(touchTimer);
                return;
            }

            e.preventDefault();
            const touch = e.touches[0];
            const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
            const thumbEl = targetEl ? targetEl.closest('.admin-gallery-thumb') : null;

            if (thumbEl && thumbEl.dataset.index !== undefined) {
                const toIdx = parseInt(thumbEl.dataset.index, 10);
                if (touchDragIndex !== toIdx) {
                    const moved = adminGalleryUrls.splice(touchDragIndex, 1)[0];
                    adminGalleryUrls.splice(toIdx, 0, moved);
                    touchDragIndex = toIdx;
                    renderAdminGalleryList();
                }
            }
        }, { passive: false });

        item.addEventListener('touchend', () => {
            clearTimeout(touchTimer);
            if (touchDragIndex !== null) {
                touchDragIndex = null;
                renderAdminGalleryList();
            }
        });

        container.appendChild(item);
    });
}

function removeAdminGalleryImg(index) {
    adminGalleryUrls.splice(index, 1);
    renderAdminGalleryList();
}

function updateStoryDday(startDateStr) {
    const ddayTextEl = document.getElementById('story-dday-text');
    if (!ddayTextEl) return;

    if (!startDateStr) {
        ddayTextEl.innerText = '+ 0 일';
        return;
    }

    const start = new Date(startDateStr);
    const now = new Date();

    if (isNaN(start.getTime())) {
        ddayTextEl.innerText = '+ 0 일';
        return;
    }

    const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffDays = Math.floor((todayMidnight - startMidnight) / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays >= 0) {
        ddayTextEl.innerText = `+ ${diffDays.toLocaleString()} 일`;
    } else {
        ddayTextEl.innerText = `- ${Math.abs(diffDays).toLocaleString()} 일`;
    }
}

function showToast(message) {
    const toast = document.getElementById('toast-msg');
    if (!toast) return;

    if (toastTimeout) clearTimeout(toastTimeout);

    toast.innerText = message;
    toast.classList.add('show');

    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2200);
}

function initFireworks() {
    const canvas = document.getElementById('intro-fireworks-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = canvas.width = canvas.parentElement.clientWidth;
    let height = canvas.height = canvas.parentElement.clientHeight;

    window.addEventListener('resize', () => {
        if (!canvas.parentElement) return;
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = canvas.parentElement.clientHeight;
    });

    const rockets = [];
    const particles = [];
    const colors = ['#ffffff', '#ffccd5', '#ff85a1', '#f72585', '#ffb703', '#ffd166', '#e7c6ff', '#e0aaff', '#7209b7'];

    class Rocket {
        constructor() {
            this.x = Math.random() * (width * 0.8) + (width * 0.1);
            this.y = height;
            this.targetY = Math.random() * (height * 0.45) + (height * 0.1);
            this.speed = Math.random() * 6 + 10;
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.exploded = false;
            this.trail = [];
        }

        update() {
            this.trail.push({ x: this.x, y: this.y });
            if (this.trail.length > 5) this.trail.shift();
            this.y -= this.speed;
            if (this.y <= this.targetY) this.exploded = true;
        }

        draw() {
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.restore();
        }
    }

    class Particle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.color = color;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 7 + 2;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
            this.alpha = 1;
            this.decay = Math.random() * 0.015 + 0.009;
            this.friction = 0.965;
            this.radius = Math.random() * 3 + 1.8;
            this.sparkle = Math.random() > 0.4;
        }

        update() {
            this.vx *= this.friction;
            this.vy *= this.friction;
            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.045;
            this.alpha -= this.decay;
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.sparkle && Math.random() > 0.35 ? this.alpha * 0.4 : Math.max(this.alpha, 0);
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 8;
            ctx.shadowColor = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function createExplosion(x, y, color) {
        for (let i = 0; i < 75; i++) {
            particles.push(new Particle(x, y, color));
        }
    }

    let frameCount = 0;
    function render() {
        ctx.clearRect(0, 0, width, height);

        if (frameCount % 16 === 0) rockets.push(new Rocket());
        frameCount++;

        for (let i = rockets.length - 1; i >= 0; i--) {
            const r = rockets[i];
            r.update();
            r.draw();
            if (r.exploded) {
                createExplosion(r.x, r.y, r.color);
                rockets.splice(i, 1);
            }
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.update();
            p.draw();
            if (p.alpha <= 0) particles.splice(i, 1);
        }

        fireworksAnimationId = requestAnimationFrame(render);
    }
    render();
}

function stopFireworks() {
    if (fireworksAnimationId) {
        cancelAnimationFrame(fireworksAnimationId);
        fireworksAnimationId = null;
    }
}

function initAdminLongPress() {
    const adminBtn = document.getElementById('admin-lock-btn');
    if (!adminBtn) return;

    const startPress = () => {
        adminPressTimer = setTimeout(() => {
            openAdminAuthModal();
            showToast('관리자 인증 모드로 진입합니다');
        }, 5000);
    };

    const cancelPress = () => {
        if (adminPressTimer) {
            clearTimeout(adminPressTimer);
            adminPressTimer = null;
        }
    };

    adminBtn.addEventListener('mousedown', startPress);
    adminBtn.addEventListener('mouseup', cancelPress);
    adminBtn.addEventListener('mouseleave', cancelPress);
    adminBtn.addEventListener('touchstart', startPress, { passive: true });
    adminBtn.addEventListener('touchend', cancelPress);
    adminBtn.addEventListener('touchcancel', cancelPress);
}

function hideIntroOverlay() {
    const introOverlay = document.getElementById('intro-overlay');
    if (introOverlay && !introOverlay.classList.contains('zoom-into-heart')) {
        introOverlay.classList.add('zoom-into-heart');
        setTimeout(stopFireworks, 900);
    }
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (activeModalStack.length === 0) {
        scrollPosition = window.pageYOffset;
        document.body.style.top = `-${scrollPosition}px`;
        document.body.classList.add('no-scroll');
    }

    modal.classList.remove('closing');
    modal.style.display = 'flex';

    if (!activeModalStack.includes(modalId)) {
        activeModalStack.push(modalId);
        history.pushState({ modalId: modalId }, '', '');
    }
}

function closeModal(modalId, isFromHistory = false) {
    const modal = document.getElementById(modalId);
    if (!modal || modal.style.display === 'none') return;

    modal.classList.add('closing');
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.remove('closing');

        const index = activeModalStack.lastIndexOf(modalId);
        if (index !== -1) {
            activeModalStack.splice(index, 1);
        }

        if (activeModalStack.length === 0) {
            document.body.classList.remove('no-scroll');
            document.body.style.top = '';
            window.scrollTo(0, scrollPosition);
        }

        if (!isFromHistory) {
            history.back();
        }
    }, 240);
}

function switchModal(fromModalId, toModalId) {
    const fromModal = document.getElementById(fromModalId);
    const toModal = document.getElementById(toModalId);
    if (!fromModal || !toModal) return;

    fromModal.style.display = 'none';
    toModal.classList.remove('closing');
    toModal.style.display = 'flex';

    const index = activeModalStack.lastIndexOf(fromModalId);
    if (index !== -1) {
        activeModalStack[index] = toModalId;
    } else {
        activeModalStack.push(toModalId);
    }
}

function handleBackdropClick(event) {
    if (event.target.classList.contains('modal-overlay')) {
        closeModal(event.target.id);
    }
}

async function fetchDBData() {
    try {
        const res = await fetch(`${APPS_SCRIPT_URL}?action=getData`);
        const data = await res.json();
        dbData = data;
        preloadStoryImages(data);
        applyDataToDOM(data);
    } catch (err) {
        console.error("DB 데이터 연동 실패:", err);
    }
}

function normalizePhoneNumber(phoneNum) {
    if (!phoneNum) return '';
    let clean = String(phoneNum).trim().replace(/[^0-9]/g, '');
    if (/^1[0-9]{8,9}$/.test(clean)) clean = '0' + clean;
    return clean;
}

function applyDataToDOM(data) {
    if (!data) return;

    const groomName = data.groom_name || '';
    const brideName = data.bride_name || '';

    if (groomName && brideName) {
        document.title = `${groomName} & ${brideName}의 모바일 청첩장`;
        const ogTitle = document.getElementById('og-title');
        if (ogTitle) ogTitle.setAttribute('content', `${groomName} ♥ ${brideName} 결혼합니다`);
    }

    if (data.hero_img) {
        document.getElementById('hero-img-element').src = data.hero_img;
        const ogImage = document.getElementById('og-image');
        if (ogImage) ogImage.setAttribute('content', data.hero_img);
    }

    document.getElementById('hero-groom-name').innerText = groomName;
    document.getElementById('hero-bride-name').innerText = brideName;
    document.getElementById('groom-name-display').innerText = groomName;
    document.getElementById('bride-name-display').innerText = brideName;

    document.getElementById('groom-baby-name').innerText = groomName;
    document.getElementById('bride-baby-name').innerText = brideName;

    if (data.groom_baby_img) document.getElementById('groom-baby-img').src = data.groom_baby_img;
    if (data.bride_baby_img) document.getElementById('bride-baby-img').src = data.bride_baby_img;

    document.getElementById('groom-intro-display').innerText = data.groom_intro_text || '';
    document.getElementById('bride-intro-display').innerText = data.bride_intro_text || '';

    const storyIntroEl = document.getElementById('story-intro-desc-display');
    if (storyIntroEl) {
        storyIntroEl.innerHTML = data.story_intro_text || "Milestone Documentation. These moments, carefully documented and lovingly preserved.<br>Relationship Development Timeline.";
    }

    updateStoryDday(data.relationship_start_date);

    if (data.story_cover_img) {
        const coverImgEl = document.getElementById('story-cover-img-element');
        if (coverImgEl) coverImgEl.src = data.story_cover_img;
    }

    renderGalleryGrid(data.gallery || []);

    if (data.wedding_datetime) {
        targetWeddingDate = new Date(data.wedding_datetime);
        
        const year = targetWeddingDate.getFullYear();
        const month = targetWeddingDate.getMonth() + 1;
        const date = targetWeddingDate.getDate();
        const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = daysOfWeek[targetWeddingDate.getDay()];
        
        let hours = targetWeddingDate.getHours();
        const minutes = targetWeddingDate.getMinutes();
        const ampm = hours >= 12 ? '오후' : '오전';
        hours = hours % 12 || 12;
        const timeStr = `${ampm} ${hours}시 ${minutes > 0 ? minutes + '분' : ''}`.trim();

        const fullDateStr = `${year}년 ${month}월 ${date}일 ${dayName}요일 ${timeStr}`;
        const venueStr = `${data.wedding_venue || ''} ${data.wedding_venue_detail || ''}`.trim();

        document.getElementById('hero-date-text').innerText = fullDateStr;
        document.getElementById('hero-venue-text').innerText = venueStr;

        document.getElementById('date-big-title-text').innerText = `${year}년 ${month}월 ${date}일`;
        document.getElementById('date-sub-info-text').innerText = `${dayName}요일 ${timeStr}`;

        renderCalendar(year, targetWeddingDate.getMonth(), date);
    }

    const venueFullText = `${data.wedding_venue || ''} ${data.wedding_venue_detail || ''}`.trim();
    document.getElementById('location-venue-text').innerText = venueFullText;
    document.getElementById('location-address-text').innerText = data.wedding_address || '';

    if (data.map_iframe_url) {
        document.getElementById('location-map-iframe').src = data.map_iframe_url;
    }

    const gFather = data.groom_father_name || '';
    const gMother = data.groom_mother_name || '';
    const bFather = data.bride_father_name || '';
    const bMother = data.bride_mother_name || '';

    const groomParentsStr = [gFather, gMother].filter(Boolean).join(' · ');
    const brideParentsStr = [bFather, bMother].filter(Boolean).join(' · ');

    document.getElementById('groom-parents-display').innerText = groomParentsStr;
    document.getElementById('bride-parents-display').innerText = brideParentsStr;

    document.getElementById('modal-groom-name').innerText = groomName;
    document.getElementById('modal-bride-name').innerText = brideName;
    document.getElementById('modal-groom-father-name').innerText = gFather;
    document.getElementById('modal-groom-mother-name').innerText = gMother;
    document.getElementById('modal-bride-father-name').innerText = bFather;
    document.getElementById('modal-bride-mother-name').innerText = bMother;

    setContactLink('btn-tel-groom', 'btn-sms-groom', data.groom_tel);
    setContactLink('btn-tel-bride', 'btn-sms-bride', data.bride_tel);
    setContactLink('btn-tel-groom-father', 'btn-sms-groom-father', data.groom_father_tel);
    setContactLink('btn-tel-groom-mother', 'btn-sms-groom-mother', data.groom_mother_tel);
    setContactLink('btn-tel-bride-father', 'btn-sms-bride-father', data.bride_father_tel);
    setContactLink('btn-tel-bride-mother', 'btn-sms-bride-mother', data.bride_mother_tel);

    updateCountdown();
}

function setContactLink(telId, smsId, phoneNum) {
    const telBtn = document.getElementById(telId);
    const smsBtn = document.getElementById(smsId);
    if (!telBtn || !smsBtn) return;

    const normalizedNum = normalizePhoneNumber(phoneNum);

    if (normalizedNum) {
        telBtn.href = `tel:${normalizedNum}`;
        smsBtn.href = `sms:${normalizedNum}`;
    } else {
        telBtn.href = 'javascript:void(0)';
        smsBtn.href = 'javascript:void(0)';
    }
}

function formatForDateTimeLocal(dateStr) {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateStr)) return dateStr;

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';

    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatForDateOnly(dateStr) {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';

    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function renderCalendar(year, month, weddingDay) {
    const container = document.getElementById('calendar-days-container');
    if (!container) return;
    container.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDate = new Date(year, month, 0).getDate();

    for (let i = firstDay - 1; i >= 0; i--) {
        const span = document.createElement('span');
        span.className = 'other-month';
        span.innerText = prevMonthLastDate - i;
        container.appendChild(span);
    }

    for (let day = 1; day <= lastDate; day++) {
        const span = document.createElement('span');
        if (day === weddingDay) {
            span.className = 'wedding-day';
        }
        span.innerText = day;
        container.appendChild(span);
    }

    const totalCells = firstDay + lastDate;
    const nextDays = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= nextDays; i++) {
        const span = document.createElement('span');
        span.className = 'other-month';
        span.innerText = i;
        container.appendChild(span);
    }
}

function updateCountdown() {
    if (!targetWeddingDate) return;

    const now = new Date();
    const diff = targetWeddingDate - now;

    const daysEl = document.getElementById('timer-days');
    const hoursEl = document.getElementById('timer-hours');
    const minsEl = document.getElementById('timer-mins');
    const secsEl = document.getElementById('timer-secs');
    const ddayTextEl = document.getElementById('dday-text');

    const groomName = dbData.groom_name || '신랑';
    const brideName = dbData.bride_name || '신부';

    const targetMidnight = new Date(targetWeddingDate.getFullYear(), targetWeddingDate.getMonth(), targetWeddingDate.getDate());
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const calendarDiffDays = Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24));

    if (ddayTextEl) {
        if (calendarDiffDays > 0) {
            ddayTextEl.innerHTML = `${groomName} <span class="dday-heart">♥</span> ${brideName}의 결혼식이 <strong>${calendarDiffDays}</strong>일 남았습니다.`;
        } else if (calendarDiffDays === 0) {
            ddayTextEl.innerHTML = `오늘이 바로 ${groomName} <span class="dday-heart">♥</span> ${brideName}의 <strong>결혼식 날</strong>입니다! 🎉`;
        } else {
            ddayTextEl.innerHTML = `${groomName} <span class="dday-heart">♥</span> ${brideName}의 결혼식이 <strong>${Math.abs(calendarDiffDays)}</strong>일 지났습니다.`;
        }
    }

    if (diff <= 0) {
        if (daysEl) daysEl.innerText = '00';
        if (hoursEl) hoursEl.innerText = '00';
        if (minsEl) minsEl.innerText = '00';
        if (secsEl) secsEl.innerText = '00';
        return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / 1000 / 60) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    updateValWithSlide(daysEl, String(days).padStart(2, '0'), 'days');
    updateValWithSlide(hoursEl, String(hours).padStart(2, '0'), 'hours');
    updateValWithSlide(minsEl, String(mins).padStart(2, '0'), 'mins');
    updateValWithSlide(secsEl, String(secs).padStart(2, '0'), 'secs');
}

function updateValWithSlide(element, newVal, key) {
    if (!element) return;
    if (prevValues[key] !== newVal) {
        element.innerText = newVal;
        element.classList.remove('slide-down');
        void element.offsetWidth;
        element.classList.add('slide-down');
        prevValues[key] = newVal;
    }
}

function openContactModal() { openModal('contact-modal'); }
function closeContactModal(isFromHistory = false) { closeModal('contact-modal', isFromHistory); }
function openAdminAuthModal() {
    document.getElementById('input-auth-pass').value = '';
    openModal('admin-auth-modal');
}
function closeAdminAuthModal(isFromHistory = false) { closeModal('admin-auth-modal', isFromHistory); }

async function verifyAdminPassword(event) {
    event.preventDefault();
    const authBtn = document.getElementById('admin-auth-btn');
    const passwordInput = document.getElementById('input-auth-pass').value;

    authBtn.disabled = true;
    authBtn.innerText = '확인 중...';

    try {
        const res = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'verify',
                password: passwordInput
            })
        });
        const result = await res.json();

        if (result.result === 'success') {
            verifiedAdminPassword = passwordInput;
            switchModal('admin-auth-modal', 'admin-modal');
            openAdminModalValues();
        } else {
            alert(result.message || '비밀번호가 일치하지 않습니다.');
        }
    } catch (err) {
        alert('비밀번호 확인 중 오류가 발생했습니다.');
        console.error(err);
    } finally {
        authBtn.disabled = false;
        authBtn.innerText = '인증하기';
    }
}

function openAdminModalValues() {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('input-groom-name', dbData.groom_name);
    setVal('input-groom-tel', normalizePhoneNumber(dbData.groom_tel));
    setVal('input-bride-name', dbData.bride_name);
    setVal('input-bride-tel', normalizePhoneNumber(dbData.bride_tel));

    setVal('input-hero-img', dbData.hero_img);
    setVal('input-wedding-datetime', formatForDateTimeLocal(dbData.wedding_datetime));
    setVal('input-wedding-venue', dbData.wedding_venue);
    setVal('input-wedding-venue-detail', dbData.wedding_venue_detail);

    setVal('input-wedding-address', dbData.wedding_address);
    setVal('input-map-iframe-url', dbData.map_iframe_url);
    setVal('input-map-image-url', dbData.map_image_url);
    setVal('input-map-search-keyword', dbData.map_search_keyword);

    setVal('input-groom-baby-img', dbData.groom_baby_img);
    setVal('input-groom-intro-text', dbData.groom_intro_text);
    setVal('input-bride-baby-img', dbData.bride_baby_img);
    setVal('input-bride-intro-text', dbData.bride_intro_text);

    setVal('input-story-intro-text', dbData.story_intro_text);
    setVal('input-relationship-start-date', formatForDateOnly(dbData.relationship_start_date));
    setVal('input-story-cover-img', dbData.story_cover_img);

    for (let i = 1; i <= 5; i++) {
        setVal(`input-story-img-${i}`, dbData[`story_img_${i}`]);
        setVal(`input-story-title-${i}`, dbData[`story_title_${i}`]);
        setVal(`input-story-desc-${i}`, dbData[`story_desc_${i}`]);
    }

    setVal('input-groom-father-name', dbData.groom_father_name);
    setVal('input-groom-father-tel', normalizePhoneNumber(dbData.groom_father_tel));
    setVal('input-groom-mother-name', dbData.groom_mother_name);
    setVal('input-groom-mother-tel', normalizePhoneNumber(dbData.groom_mother_tel));

    setVal('input-bride-father-name', dbData.bride_father_name);
    setVal('input-bride-father-tel', normalizePhoneNumber(dbData.bride_father_tel));
    setVal('input-bride-mother-name', dbData.bride_mother_name);
    setVal('input-bride-mother-tel', normalizePhoneNumber(dbData.bride_mother_tel));

    adminGalleryUrls = dbData.gallery ? [...dbData.gallery] : [];
    renderAdminGalleryList();
}

function closeAdminModal(isFromHistory = false) {
    closeModal('admin-modal', isFromHistory);
}

async function saveAdminSettings(event) {
    event.preventDefault();
    const saveBtn = document.getElementById('admin-save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerText = '저장 중...';
    }

    try {
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : '';
        };

        const payloadData = {
            groom_name: getVal('input-groom-name'),
            groom_tel: normalizePhoneNumber(getVal('input-groom-tel')),
            bride_name: getVal('input-bride-name'),
            bride_tel: normalizePhoneNumber(getVal('input-bride-tel')),
            hero_img: getVal('input-hero-img'),
            wedding_datetime: getVal('input-wedding-datetime'),
            wedding_venue: getVal('input-wedding-venue'),
            wedding_venue_detail: getVal('input-wedding-venue-detail'),
            wedding_address: getVal('input-wedding-address'),
            map_iframe_url: getVal('input-map-iframe-url'),
            map_image_url: getVal('input-map-image-url'),
            map_search_keyword: getVal('input-map-search-keyword'),
            groom_baby_img: getVal('input-groom-baby-img'),
            groom_intro_text: getVal('input-groom-intro-text'),
            bride_baby_img: getVal('input-bride-baby-img'),
            bride_intro_text: getVal('input-bride-intro-text'),
            story_intro_text: getVal('input-story-intro-text'),
            relationship_start_date: getVal('input-relationship-start-date'),
            story_cover_img: getVal('input-story-cover-img'),
            groom_father_name: getVal('input-groom-father-name'),
            groom_father_tel: normalizePhoneNumber(getVal('input-groom-father-tel')),
            groom_mother_name: getVal('input-groom-mother-name'),
            groom_mother_tel: normalizePhoneNumber(getVal('input-groom-mother-tel')),
            bride_father_name: getVal('input-bride-father-name'),
            bride_father_tel: normalizePhoneNumber(getVal('input-bride-father-tel')),
            bride_mother_name: getVal('input-bride-mother-name'),
            bride_mother_tel: normalizePhoneNumber(getVal('input-bride-mother-tel'))
        };

        for (let i = 1; i <= 5; i++) {
            payloadData[`story_img_${i}`] = getVal(`input-story-img-${i}`);
            payloadData[`story_title_${i}`] = getVal(`input-story-title-${i}`);
            payloadData[`story_desc_${i}`] = getVal(`input-story-desc-${i}`);
        }

        const payload = {
            password: verifiedAdminPassword,
            data: payloadData,
            gallery: adminGalleryUrls
        };

        const res = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        const resText = await res.text();
        let result;
        try {
            result = JSON.parse(resText);
        } catch (e) {
            console.error("서버 응답 파싱 실패:", resText);
            throw new Error("구글 앱스 스크립트 서버 응답 오류입니다. 앱스 스크립트 웹 앱 배포 버전을 확인해주세요.");
        }

        if (result.result === 'success') {
            alert('성공적으로 저장되었습니다!');
            dbData = { ...dbData, ...payload.data, gallery: adminGalleryUrls };
            applyDataToDOM(dbData);
            closeAdminModal();
        } else {
            alert(result.message || '저장에 실패했습니다.');
        }
    } catch (err) {
        alert('저장 중 오류가 발생했습니다: ' + err.message);
        console.error(err);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerText = '저장하기';
        }
    }
}

function initSakura() {
    const canvas = document.getElementById('sakura-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = canvas.width = canvas.parentElement.clientWidth;
    let height = canvas.height = canvas.parentElement.clientHeight;

    window.addEventListener('resize', () => {
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = canvas.parentElement.clientHeight;
    });

    const petalColors = ['rgba(255, 204, 213, 0.9)', 'rgba(255, 226, 232, 0.85)', 'rgba(255, 182, 193, 0.8)', 'rgba(255, 240, 243, 0.95)'];
    const totalPetals = 30;
    const petals = [];

    class Petal {
        constructor() { this.reset(); }
        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * -height;
            this.size = Math.random() * 7 + 6;
            this.color = petalColors[Math.floor(Math.random() * petalColors.length)];
            this.speedY = Math.random() * 1.2 + 0.8;
            this.speedX = Math.random() * 0.6 - 0.3;
            this.angle = Math.random() * Math.PI * 2;
            this.angularVelocity = Math.random() * 0.03 - 0.015;
            this.flip = Math.random() * Math.PI;
            this.flipSpeed = Math.random() * 0.03 + 0.01;
            this.oscillation = Math.random() * 0.02 + 0.01;
        }
        update() {
            this.y += this.speedY;
            this.x += Math.sin(this.y * this.oscillation) * 1.2 + this.speedX;
            this.angle += this.angularVelocity;
            this.flip += this.flipSpeed;
            if (this.y > height + 20) { this.reset(); this.y = -10; }
        }
        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.scale(Math.cos(this.flip), 1);
            ctx.fillStyle = this.color;
            ctx.beginPath();
            const r = this.size;
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-r, -r * 0.8, -r * 1.2, -r * 1.8, 0, -r * 2.2);
            ctx.bezierCurveTo(r * 1.2, -r * 1.8, r, -r * 0.8, 0, 0);
            ctx.fill();
            ctx.restore();
        }
    }

    for (let i = 0; i < totalPetals; i++) petals.push(new Petal());

    function render() {
        ctx.clearRect(0, 0, width, height);
        petals.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(render);
    }
    render();
}

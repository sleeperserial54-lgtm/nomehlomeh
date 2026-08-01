onload = () => {
  const vaultCode = "052723";
  const vault = document.querySelector(".memory-vault");
  const book = document.querySelector(".memory-book");
  const vaultForm = document.querySelector(".vault__form");
  const vaultInput = document.querySelector(".vault__code");
  const vaultMessage = document.querySelector(".vault__message");
  const celebrationDialog = document.querySelector(".celebration-dialog");
  const memoryStrip = document.querySelector(".memory-strip");
  const hoverPreview = document.querySelector(".memory-hover-preview");
  const previewImage = document.querySelector(".memory-hover-preview__image");
  const previewTitle = document.querySelector(".memory-hover-preview h2");
  const previewNote = document.querySelector(".memory-hover-preview__note");
  const previewCount = document.querySelector(".memory-hover-preview__count");
  const musicEmbed = document.querySelector(".music-player__embed");
  const musicSong = document.querySelector(".music-player__song");
  const musicPlayer = document.querySelector(".music-player");
  const musicControls = document.querySelectorAll(".music-player__button");
  const musicPrevious = document.querySelector(".music-player__previous");
  const musicToggle = document.querySelector(".music-player__toggle");
  const musicNext = document.querySelector(".music-player__next");
  const configuredApiUrl = document.querySelector('meta[name="memory-api-url"]')?.content.trim().replace(/\/$/, "");
const apiBase = configuredApiUrl || "";
const apiUrl = (path) => `${apiBase}${path}`;
const memoryApi = apiUrl("/api/memories");
const imageUrl = (path) => new URL(path, apiBase ? `${apiBase}/` : window.location.href).href;
  let memories = [];
  let activeMemory = 0;
  let youtubePlayer;

  const setMusicControlsEnabled = (enabled) => musicControls.forEach((control) => { control.disabled = !enabled; });
  const updateSongTitle = (player, fallback = "YouTube playlist") => {
    musicSong.textContent = player.getVideoData().title || fallback;
  };
  const setMusicPlaying = (isPlaying) => {
    musicPlayer.classList.toggle("music-player--playing", isPlaying);
    musicToggle.textContent = isPlaying ? "❚❚" : "▶";
    musicToggle.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
  };

  document.querySelectorAll(".flower__leafs").forEach((head) => {
    const petals = document.createElement("div");
    petals.className = "daisy-petals";
    for (let index = 0; index < 18; index += 1) {
      const petal = document.createElement("span");
      petal.style.setProperty("--petal-angle", `${index * 20}deg`);
      petal.style.setProperty("--petal-delay", `${index * 0.035}s`);
      petals.appendChild(petal);
    }
    head.querySelectorAll(".flower__leaf").forEach((petal) => petal.remove());
    head.insertBefore(petals, head.querySelector(".flower__white-circle"));
  });

  const floatingFlowerField = document.createElement("div");
  floatingFlowerField.className = "floating-flower-field";
  floatingFlowerField.setAttribute("aria-hidden", "true");
  const flowerTypes = ["daisy", "tulip", "rose", "wildflower"];
  for (let index = 0; index < 24; index += 1) {
    const flower = document.createElement("span");
    flower.className = `floating-flower floating-flower--${flowerTypes[Math.floor(Math.random() * flowerTypes.length)]}`;
    flower.style.setProperty("--flower-left", `${Math.random() * 100}%`);
    flower.style.setProperty("--flower-size", `${1.1 + Math.random() * 2.4}rem`);
    flower.style.setProperty("--flower-duration", `${10 + Math.random() * 12}s`);
    flower.style.setProperty("--flower-delay", `${-Math.random() * 20}s`);
    flower.style.setProperty("--flower-drift", `${-7 + Math.random() * 14}vw`);
    floatingFlowerField.append(flower);
  }
  book.prepend(floatingFlowerField);

  const renderCarousel = () => {
    memoryStrip.replaceChildren();
    if (!memories.length) {
      const empty = document.createElement("p");
      empty.className = "memory-empty";
      empty.textContent = "No memories have been added yet.";
      memoryStrip.append(empty);
      return;
    }
    const track = document.createElement("div");
    track.className = "memory-track";
    for (let copy = 0; copy < 2; copy += 1) {
      const group = document.createElement("div");
      group.className = "memory-track__group";
      memories.forEach((memory, index) => {
      const card = document.createElement("button");
      const scene = document.createElement("span");
      const label = document.createElement("span");
      card.type = "button";
      card.className = "memory-card memory-card--uploaded";
      card.dataset.index = index;
      card.setAttribute("role", "listitem");
      card.classList.toggle("memory-card--active", index === activeMemory);
      scene.className = "memory-card__scene";
      scene.style.backgroundImage = `url("${memory.imageUrl}")`;
      scene.style.backgroundSize = "cover";
      scene.style.backgroundPosition = "center";
      label.textContent = memory.title;
      card.append(scene, label);
      group.append(card);
      });
      track.append(group);
    }
    memoryStrip.append(track);
  };

  const launchCelebration = () => {
    const confetti = document.createElement("div");
    confetti.className = "celebration-confetti";
    const colors = ["#f4bd41", "#ff6d72", "#8ed0bf", "#b59aff", "#ffffff"];
    for (let index = 0; index < 46; index += 1) {
      const piece = document.createElement("span");
      piece.style.setProperty("--confetti-left", `${Math.random() * 100}%`);
      piece.style.setProperty("--confetti-delay", `${Math.random() * 0.55}s`);
      piece.style.setProperty("--confetti-shift", `${Math.random() * 120 - 60}px`);
      piece.style.setProperty("--confetti-rotate", `${Math.random() * 540 - 270}deg`);
      piece.style.backgroundColor = colors[index % colors.length];
      confetti.append(piece);
    }
    celebrationDialog.prepend(confetti);
    setTimeout(() => confetti.remove(), 3200);
  };

  const showMemory = (index, revealPreview = true, redrawCarousel = false) => {
    if (!memories.length) return;
    activeMemory = (index + memories.length) % memories.length;
    const memory = memories[activeMemory];
    previewImage.className = "memory-hover-preview__image memory-card--uploaded";
    previewImage.style.backgroundImage = `url("${memory.imageUrl}")`;
    previewImage.style.backgroundSize = "cover";
    previewImage.style.backgroundPosition = "center";
    previewTitle.textContent = memory.title;
    previewNote.textContent = memory.note;
    previewCount.textContent = `${activeMemory + 1} / ${memories.length}`;
    hoverPreview.classList.toggle("memory-hover-preview--visible", revealPreview);
    hoverPreview.setAttribute("aria-hidden", String(!revealPreview));
    if (redrawCarousel) renderCarousel();
    else memoryStrip.querySelectorAll(".memory-card").forEach((card) => card.classList.toggle("memory-card--active", Number(card.dataset.index) === activeMemory));
  };

  const loadMemories = async () => {
    try {
      const response = await fetch(memoryApi);
      if (!response.ok) throw new Error();
      memories = await response.json();
      activeMemory = 0;
      renderCarousel();
    } catch {
      memoryStrip.replaceChildren();
      const message = document.createElement("p");
      message.className = "memory-empty";
      message.textContent = "Memories are unavailable right now.";
      memoryStrip.append(message);
    }
  };

  const loadYouTubeApi = () => new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve();
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = reject;
    window.onYouTubeIframeAPIReady = resolve;
    document.head.append(script);
  });

  const getMediaInfo = (url) => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, "");

      if (host === "youtube.com" || host === "m.youtube.com") {
        const videoId = parsed.searchParams.get("v");
        const listId = parsed.searchParams.get("list");
        if (videoId) return { type: "youtube", kind: "video", id: videoId };
        if (listId) return { type: "youtube", kind: "playlist", id: listId };
        return null;
      }

      if (host === "youtu.be") {
        const shortId = parsed.pathname.split("/").filter(Boolean)[0];
        if (shortId) return { type: "youtube", kind: "video", id: shortId };
        return null;
      }

      if (host === "open.spotify.com") {
        const match = parsed.pathname.match(/\/(track|playlist|album|artist)\/([A-Za-z0-9]+)/i);
        if (match) return { type: "spotify", kind: match[1], id: match[2] };
      }

      return null;
    } catch {
      return null;
    }
  };

  const loadMusic = async () => {
    try {
      const response = await fetch(window.location.port === "3000" ? "/api/music" : "http://localhost:3000/api/music");
      const { playlistUrl } = await response.json();
      musicEmbed.replaceChildren();
      if (!playlistUrl) return;

      const media = getMediaInfo(playlistUrl);
      if (!media) throw new Error("Media URL invalid");

      if (media.type === "spotify") {
        const iframe = document.createElement("iframe");
        iframe.src = `https://open.spotify.com/embed/${media.kind}/${media.id}`;
        iframe.width = "100%";
        iframe.height = "80";
        iframe.frameBorder = "0";
        iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
        iframe.loading = "lazy";
        musicEmbed.append(iframe);
        musicSong.textContent = media.kind === "track" ? "Spotify track" : "Spotify playlist";
        setMusicControlsEnabled(false);
        return;
      }

      
      const playerTarget = document.createElement("div");
      playerTarget.id = "youtube-player";
      musicEmbed.append(playerTarget);
      await loadYouTubeApi();

      if (media.kind === "playlist") {
        youtubePlayer = new window.YT.Player(playerTarget.id, {
          height: "1",
          width: "1",
          playerVars: { listType: "playlist", list: media.id, playsinline: 1, rel: 0, controls: 0, autoplay: 1 },
          events: {
            onReady: (event) => {
              updateSongTitle(event.target);
              setMusicControlsEnabled(true);
              event.target.playVideo();
            },
            onStateChange: (event) => {
              if (event.data === window.YT.PlayerState.PLAYING) {
                setMusicPlaying(true);
                updateSongTitle(event.target, "Now playing");
              } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
                setMusicPlaying(false);
                updateSongTitle(event.target);
              }
            },
          },
        });
        return;
      }
      
      youtubePlayer = new window.YT.Player(playerTarget.id, {
        height: "1",
        width: "1",
        playerVars: { playsinline: 1, rel: 0, controls: 0, autoplay: 1 },
        events: {
          onReady: (event) => {
            updateSongTitle(event.target);
            setMusicControlsEnabled(true);
            event.target.playVideo();
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setMusicPlaying(true);
              updateSongTitle(event.target, "Now playing");
            } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
              setMusicPlaying(false);
              updateSongTitle(event.target);
            }
          },
        },
      });
    } catch {
      musicSong.textContent = "Playlist unavailable.";
    }
  };

  musicPrevious.addEventListener("click", () => youtubePlayer?.previousVideo());
  musicToggle.addEventListener("click", () => {
    if (youtubePlayer?.getPlayerState() === window.YT.PlayerState.PLAYING) youtubePlayer.pauseVideo();
    else youtubePlayer?.playVideo();
  });
  musicNext.addEventListener("click", () => youtubePlayer?.nextVideo());

  memoryStrip.addEventListener("click", (event) => {
    const card = event.target.closest(".memory-card");
    if (card) showMemory(Number(card.dataset.index));
  });
  memoryStrip.addEventListener("mouseover", (event) => {
    const card = event.target.closest(".memory-card");
    if (card && Number(card.dataset.index) !== activeMemory) showMemory(Number(card.dataset.index));
  });
  memoryStrip.addEventListener("focusin", (event) => {
    const card = event.target.closest(".memory-card");
    if (card) showMemory(Number(card.dataset.index));
  });
  memoryStrip.addEventListener("mouseleave", () => {
    hoverPreview.classList.remove("memory-hover-preview--visible");
    hoverPreview.setAttribute("aria-hidden", "true");
  });
  book.addEventListener("click", (event) => {
    if (event.target.closest(".memory-card, .memory-hover-preview, button, input, textarea, a")) return;
    const daisy = document.createElement("span");
    daisy.className = "click-daisy";
    daisy.style.left = `${event.clientX}px`;
    daisy.style.top = `${event.clientY}px`;
    book.append(daisy);
    setTimeout(() => daisy.remove(), 1500);
  });

  vaultInput.addEventListener("input", () => {
    vaultInput.value = vaultInput.value.replace(/\D/g, "").slice(0, 6);
    vaultMessage.textContent = "";
  });
  vaultForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (vaultInput.value === vaultCode) {
      vault.classList.add("memory-vault--opening");
      vaultMessage.textContent = "Vault unlocked.";
      setTimeout(() => {
        vault.setAttribute("aria-hidden", "true");
        vault.classList.remove("memory-vault--visible");
        launchCelebration();
        celebrationDialog.showModal();
      }, 700);
      return;
    }
    vaultMessage.textContent = "That code does not open this vault. Try again.";
    vaultInput.select();
    vaultForm.classList.remove("vault__form--error");
    void vaultForm.offsetWidth;
    vaultForm.classList.add("vault__form--error");
  });
  celebrationDialog.querySelector("button").addEventListener("click", async () => {
    celebrationDialog.close();
    book.setAttribute("aria-hidden", "false");
    book.classList.add("memory-book--visible");
    await Promise.all([loadMemories(), loadMusic()]);
  });

  const c = setTimeout(() => {
    document.body.classList.remove("not-loaded");
    clearTimeout(c);
  }, 1000);
  setTimeout(() => {
    vault.setAttribute("aria-hidden", "false");
    vault.classList.add("memory-vault--visible");
    vaultInput.focus();
  }, 6500);
};

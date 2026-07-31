const loginPanel = document.querySelector("#login-panel");
const memoryPanel = document.querySelector("#memory-panel");
const loginForm = document.querySelector("#login-form");
const loginStatus = document.querySelector("#login-status");
const memoryForm = document.querySelector("#memory-form");
const status = document.querySelector("#status");
const memoryList = document.querySelector("#memory-list");
const musicForm = document.querySelector("#music-form");
const musicStatus = document.querySelector("#music-status");

const showAdmin = (authenticated) => {
  loginPanel.hidden = authenticated;
  memoryPanel.hidden = !authenticated;
};

const checkSession = async () => {
  try {
    const response = await fetch("/api/admin/session");
    const { authenticated } = await response.json();
    showAdmin(authenticated);
    if (authenticated) loadMusicSettings();
  } catch {
    loginStatus.textContent = "Cannot reach the server. Open this page at http://localhost:3000/admin.";
    showAdmin(false);
  }
};

const loadMusicSettings = async () => {
  const response = await fetch("/api/music");
  const { playlistUrl } = await response.json();
  musicForm.elements.playlistUrl.value = playlistUrl;
};

const loadMemories = async () => {
  const response = await fetch("/api/memories");
  const memories = await response.json();
  memoryList.replaceChildren();
  if (!memories.length) {
    const empty = document.createElement("p");
    empty.textContent = "No uploaded memories yet.";
    memoryList.append(empty);
    return;
  }
  memories.forEach((memory) => {
    const item = document.createElement("article");
    const image = document.createElement("img");
    const title = document.createElement("strong");
    const remove = document.createElement("button");
    image.src = memory.imageUrl;
    image.alt = "";
    title.textContent = memory.title;
    remove.type = "button";
    remove.className = "memory-list__delete";
    remove.textContent = "Delete";
    remove.addEventListener("click", async () => {
      if (!confirm(`Delete “${memory.title}”? This cannot be undone.`)) return;
      const response = await fetch(`/api/memories/${memory.id}`, { method: "DELETE" });
      if (!response.ok) {
        status.textContent = "Could not delete this memory.";
        return;
      }
      status.textContent = "Memory deleted.";
      loadMemories();
    });
    item.append(image, title, remove);
    memoryList.append(item);
  });
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "Checking credentials...";
  const formData = new FormData(loginForm);
  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: formData.get("username"), password: formData.get("password") }),
    });
    const result = await response.json();
    if (!response.ok) {
      loginStatus.textContent = result.error || "Could not sign in.";
      return;
    }
    loginForm.reset();
    loginStatus.textContent = "";
    showAdmin(true);
    loadMusicSettings();
  } catch {
    loginStatus.textContent = "Cannot reach the server. Open this page at http://localhost:3000/admin.";
  }
});

memoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "Saving memory...";
  try {
    const response = await fetch("/api/memories", { method: "POST", body: new FormData(memoryForm) });
    const result = await response.json();
    if (!response.ok) {
      status.textContent = result.error || "Could not save this memory.";
      if (response.status === 401) showAdmin(false);
      return;
    }
  memoryForm.reset();
  status.textContent = `Saved “${result.title}”. It is now in the public carousel.`;
  loadMemories();
  } catch {
    status.textContent = "Could not reach the server. Please try again.";
  }
});

musicForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  musicStatus.textContent = "Saving playlist...";
  const response = await fetch("/api/music", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playlistUrl: musicForm.elements.playlistUrl.value }),
  });
  const result = await response.json();
  musicStatus.textContent = response.ok ? "Playlist saved for the public player." : (result.error || "Could not save the playlist.");
});

document.querySelector("#logout").addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  showAdmin(false);
});

checkSession();
loadMemories();

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useData, useRouter } from 'vitepress';

const { site, isDark } = useData();
const router = useRouter();

// GitHub stats
const stars = ref('-');
const forks = ref('-');
const version = ref('-');

const formatNumber = (num: number): string => {
  return num > 1000 ? (num / 1000).toFixed(1) + 'k' : num.toString();
};

onMounted(async () => {
  try {
    const [repoRes, releaseRes] = await Promise.all([
      fetch('https://api.github.com/repos/corvo007/Gemini-Subtitle-Pro'),
      fetch('https://api.github.com/repos/corvo007/Gemini-Subtitle-Pro/releases/latest')
    ]);
    const repoJson = await repoRes.json();
    const releaseJson = await releaseRes.json();

    stars.value = typeof repoJson.stargazers_count === 'number' 
      ? formatNumber(repoJson.stargazers_count) : '-';
    forks.value = typeof repoJson.forks_count === 'number' 
      ? formatNumber(repoJson.forks_count) : '-';
    version.value = releaseJson.tag_name || 'latest';
  } catch (e) {
    console.error('Failed to fetch GitHub stats:', e);
  }
});

// Language switcher
const currentLang = computed(() => {
  const path = router.route.path;
  return path.startsWith('/en/') ? 'en' : 'zh';
});

const switchLang = () => {
  const path = router.route.path;
  if (currentLang.value === 'zh') {
    router.go('/en' + path);
  } else {
    router.go(path.replace(/^\/en/, '') || '/');
  }
};

// Theme toggle
const toggleTheme = () => {
  isDark.value = !isDark.value;
};
</script>

<template>
  <div class="nav-controls">
    <!-- Language Switcher -->
    <button class="nav-btn" @click="switchLang" :title="currentLang === 'zh' ? 'Switch to English' : '切换到中文'">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m5 8 6 6"/>
        <path d="m4 14 6-6 2-3"/>
        <path d="M2 5h12"/>
        <path d="M7 2h1"/>
        <path d="m22 22-5-10-5 10"/>
        <path d="M14 18h6"/>
      </svg>
      <span class="lang-label">{{ currentLang === 'zh' ? 'EN' : '中' }}</span>
    </button>

    <!-- Theme Toggle -->
    <button class="nav-btn" @click="toggleTheme" :title="isDark ? 'Light mode' : 'Dark mode'">
      <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2"/>
        <path d="M12 20v2"/>
        <path d="m4.93 4.93 1.41 1.41"/>
        <path d="m17.66 17.66 1.41 1.41"/>
        <path d="M2 12h2"/>
        <path d="M20 12h2"/>
        <path d="m6.34 17.66-1.41 1.41"/>
        <path d="m19.07 4.93-1.41 1.41"/>
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
      </svg>
    </button>

    <!-- GitHub Link -->
    <a href="https://github.com/corvo007/Gemini-Subtitle-Pro" target="_blank" rel="noopener" class="github-link">
      <svg height="20" viewBox="0 0 16 16" width="20" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
      </svg>
      <span class="github-stats">
        <span class="stat">{{ version }}</span>
        <span class="stat">★ {{ stars }}</span>
      </span>
    </a>
  </div>
</template>

<style scoped>
.nav-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 12px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: var(--vp-c-text-2);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.nav-btn:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
}

.lang-label {
  font-size: 12px;
  font-weight: 600;
}

.github-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  color: var(--vp-c-text-2);
  text-decoration: none;
  border-radius: 6px;
  transition: all 0.2s;
}

.github-link:hover {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
}

.github-stats {
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.stat {
  white-space: nowrap;
}

/* 中等屏幕：隐藏详细统计，只显示图标 */
@media (max-width: 1100px) {
  .github-stats {
    display: none;
  }
  
  .lang-label {
    display: none;
  }
}

/* 小屏幕：进一步简化 */
@media (max-width: 768px) {
  .nav-controls {
    display: none;
  }
}
</style>

import DefaultTheme from 'vitepress/theme';
import { onMounted, watch, nextTick, h } from 'vue';
import { useRoute } from 'vitepress';
import './custom.css';
import GitHubStats from '../components/GitHubStats.vue';

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(GitHubStats),
    });
  },
  setup() {
    const route = useRoute();

    const addMermaidControls = () => {
      nextTick(() => {
        const mermaidContainers = document.querySelectorAll('.mermaid');

        mermaidContainers.forEach((container, index) => {
          if (container.parentElement?.classList.contains('mermaid-wrapper')) return;

          const wrapper = document.createElement('div');
          wrapper.className = 'mermaid-wrapper';
          wrapper.setAttribute('data-index', String(index));

          // GitHub 风格浮动控制面板 - Lucide 风格 stroke 图标
          const controls = document.createElement('div');
          controls.className = 'mermaid-controls';
          controls.innerHTML = `
            <div class="control-row">
              <button class="control-btn pan-up" title="上移">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
              </button>
              <button class="control-btn zoom-in" title="放大">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
            </div>
            <div class="control-row">
              <button class="control-btn pan-left" title="左移">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button class="control-btn reset" title="重置">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
              <button class="control-btn pan-right" title="右移">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
            <div class="control-row">
              <button class="control-btn pan-down" title="下移">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <button class="control-btn zoom-out" title="缩小">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
            </div>
          `;

          // 顶部工具栏 - Lucide 风格
          const topBar = document.createElement('div');
          topBar.className = 'mermaid-topbar';
          topBar.innerHTML = `
            <button class="topbar-btn expand" title="全屏查看">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            </button>
            <button class="topbar-btn copy" title="复制代码">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          `;

          const scrollContainer = document.createElement('div');
          scrollContainer.className = 'mermaid-scroll-container';

          container.parentNode?.insertBefore(wrapper, container);
          scrollContainer.appendChild(container);
          wrapper.appendChild(topBar);
          wrapper.appendChild(scrollContainer);
          wrapper.appendChild(controls);

          // 状态
          let scale = 1;
          let translateX = 0;
          let translateY = 0;
          let isDragging = false;
          let lastX = 0;
          let lastY = 0;
          const panStep = 50;

          const updateTransform = () => {
            (container as HTMLElement).style.transform =
              `translate(${translateX}px, ${translateY}px) scale(${scale})`;
          };

          // 缩放
          controls.querySelector('.zoom-in')?.addEventListener('click', () => {
            scale = Math.min(scale + 0.25, 4);
            updateTransform();
          });

          controls.querySelector('.zoom-out')?.addEventListener('click', () => {
            scale = Math.max(scale - 0.25, 0.25);
            updateTransform();
          });

          // 平移
          controls.querySelector('.pan-up')?.addEventListener('click', () => {
            translateY += panStep;
            updateTransform();
          });

          controls.querySelector('.pan-down')?.addEventListener('click', () => {
            translateY -= panStep;
            updateTransform();
          });

          controls.querySelector('.pan-left')?.addEventListener('click', () => {
            translateX += panStep;
            updateTransform();
          });

          controls.querySelector('.pan-right')?.addEventListener('click', () => {
            translateX -= panStep;
            updateTransform();
          });

          // 重置
          controls.querySelector('.reset')?.addEventListener('click', () => {
            scale = 1;
            translateX = 0;
            translateY = 0;
            updateTransform();
          });

          // 全屏
          topBar.querySelector('.expand')?.addEventListener('click', () => {
            wrapper.classList.toggle('fullscreen');
            const btn = topBar.querySelector('.expand');
            if (btn) btn.textContent = wrapper.classList.contains('fullscreen') ? '✕' : '↔';
            if (!wrapper.classList.contains('fullscreen')) {
              scale = 1;
              translateX = 0;
              translateY = 0;
              updateTransform();
            }
          });

          // 拖拽
          scrollContainer.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            scrollContainer.style.cursor = 'grabbing';
          });

          document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            translateX += e.clientX - lastX;
            translateY += e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            updateTransform();
          });

          document.addEventListener('mouseup', () => {
            isDragging = false;
            scrollContainer.style.cursor = 'grab';
          });

          // 滚轮缩放
          scrollContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.15 : 0.15;
            scale = Math.max(0.25, Math.min(4, scale + delta));
            updateTransform();
          });
        });
      });
    };

    onMounted(() => {
      setTimeout(addMermaidControls, 1000);
    });

    watch(
      () => route.path,
      () => {
        setTimeout(addMermaidControls, 1000);
      }
    );
  },
};

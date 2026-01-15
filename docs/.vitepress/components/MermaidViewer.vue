<script setup>
import { ref, onMounted, nextTick } from 'vue'

const props = defineProps({
  code: {
    type: String,
    required: true
  }
})

const container = ref(null)
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const isFullscreen = ref(false)
const isDragging = ref(false)
const lastX = ref(0)
const lastY = ref(0)

const zoomIn = () => {
  scale.value = Math.min(scale.value + 0.2, 3)
}

const zoomOut = () => {
  scale.value = Math.max(scale.value - 0.2, 0.3)
}

const resetView = () => {
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  if (!isFullscreen.value) {
    resetView()
  }
}

const onMouseDown = (e) => {
  if (e.button !== 0) return
  isDragging.value = true
  lastX.value = e.clientX
  lastY.value = e.clientY
  e.preventDefault()
}

const onMouseMove = (e) => {
  if (!isDragging.value) return
  const dx = e.clientX - lastX.value
  const dy = e.clientY - lastY.value
  translateX.value += dx
  translateY.value += dy
  lastX.value = e.clientX
  lastY.value = e.clientY
}

const onMouseUp = () => {
  isDragging.value = false
}

const onWheel = (e) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  scale.value = Math.max(0.3, Math.min(3, scale.value + delta))
}
</script>

<template>
  <div 
    :class="['mermaid-wrapper', { 'fullscreen': isFullscreen }]"
  >
    <div class="mermaid-toolbar">
      <button @click="zoomIn" title="放大 / Zoom In">🔍+</button>
      <button @click="zoomOut" title="缩小 / Zoom Out">🔍−</button>
      <button @click="resetView" title="重置 / Reset">↺</button>
      <button @click="toggleFullscreen" title="全屏 / Fullscreen">
        {{ isFullscreen ? '✕' : '⛶' }}
      </button>
      <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
    </div>
    <div 
      class="mermaid-container"
      ref="container"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
      @wheel="onWheel"
      :style="{ cursor: isDragging ? 'grabbing' : 'grab' }"
    >
      <div 
        class="mermaid-content"
        :style="{
          transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
          transformOrigin: 'center center'
        }"
      >
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mermaid-wrapper {
  position: relative;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  margin: 16px 0;
  background: var(--vp-c-bg-soft);
}

.mermaid-wrapper.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  border-radius: 0;
  margin: 0;
  background: var(--vp-c-bg);
}

.mermaid-toolbar {
  display: flex;
  gap: 4px;
  padding: 8px;
  background: var(--vp-c-bg);
  border-bottom: 1px solid var(--vp-c-divider);
}

.mermaid-toolbar button {
  padding: 4px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.mermaid-toolbar button:hover {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand);
}

.zoom-level {
  margin-left: auto;
  font-size: 12px;
  color: var(--vp-c-text-2);
  align-self: center;
}

.mermaid-container {
  overflow: hidden;
  min-height: 300px;
  height: 100%;
}

.fullscreen .mermaid-container {
  height: calc(100vh - 50px);
}

.mermaid-content {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  padding: 20px;
  transition: transform 0.1s ease-out;
}

.fullscreen .mermaid-content {
  min-height: calc(100vh - 100px);
}
</style>

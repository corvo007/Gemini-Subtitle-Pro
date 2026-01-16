import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(
  defineConfig({
    title: 'Gemini Subtitle Pro',
    description: '专业级字幕，零人工校对',
    srcExclude: ['plans/**'],
    cleanUrls: true,

    head: [['link', { rel: 'icon', href: '/icon.png' }]],

    locales: {
      root: {
        label: '简体中文',
        lang: 'zh-CN',
        themeConfig: {
          nav: [
            { text: '首页', link: '/' },
            { text: '指南', link: '/guide/' },
            { text: '架构', link: '/architecture/' },
            {
              text: '在线体验',
              link: 'https://aisub-demo.netlify.app/',
            },
          ],
          sidebar: {
            '/guide/': [
              {
                text: '指南',
                items: [
                  { text: '快速开始', link: '/guide/' },
                  { text: '本地 Whisper 配置', link: '/guide/whisper' },
                  { text: '时间轴强制对齐', link: '/guide/alignment' },
                  { text: '视频下载支持', link: '/guide/video-download' },
                ],
              },
            ],
            '/architecture/': [
              {
                text: '架构文档',
                items: [
                  { text: '项目概述', link: '/architecture/' },
                  { text: '模块架构', link: '/architecture/modules' },
                  { text: 'Pipeline 流程', link: '/architecture/pipeline' },
                  { text: '桌面端功能', link: '/architecture/desktop' },
                  { text: '核心模块', link: '/architecture/core-modules' },
                ],
              },
            ],
          },
        },
      },
      en: {
        label: 'English',
        lang: 'en-US',
        link: '/en/',
        themeConfig: {
          nav: [
            { text: 'Home', link: '/en/' },
            { text: 'Guide', link: '/en/guide/' },
            { text: 'Architecture', link: '/en/architecture/' },
            {
              text: 'Live Demo',
              link: 'https://aisub-demo.netlify.app/',
            },
          ],
          sidebar: {
            '/en/guide/': [
              {
                text: 'Guide',
                items: [
                  { text: 'Getting Started', link: '/en/guide/' },
                  { text: 'Local Whisper Setup', link: '/en/guide/whisper' },
                  { text: 'Timeline Alignment', link: '/en/guide/alignment' },
                  { text: 'Video Download', link: '/en/guide/video-download' },
                ],
              },
            ],
            '/en/architecture/': [
              {
                text: 'Architecture',
                items: [
                  { text: 'Overview', link: '/en/architecture/' },
                  { text: 'Module Architecture', link: '/en/architecture/modules' },
                  { text: 'Pipeline Flow', link: '/en/architecture/pipeline' },
                  { text: 'Desktop Features', link: '/en/architecture/desktop' },
                  { text: 'Core Modules', link: '/en/architecture/core-modules' },
                ],
              },
            ],
          },
        },
      },
    },

    themeConfig: {
      logo: '/icon.png',

      socialLinks: [],

      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright © 2024 Corvo007',
      },

      search: {
        provider: 'local',
        options: {
          locales: {
            root: {
              translations: {
                button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
                modal: {
                  noResultsText: '没有找到结果',
                  resetButtonTitle: '清除',
                  footer: { selectText: '选择', navigateText: '导航', closeText: '关闭' },
                },
              },
            },
          },
        },
      },
    },
  })
);

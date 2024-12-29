import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Vue3 I Know",
  description: "Learn the Vue3 code",
  srcDir: './src',
  base: '/vue-i-know/',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Start', link: '/fn-patch' }
    ],

    sidebar: [
      {
        text: 'Learn',
        items: [
          { text: 'Patch函数', link: '/fn-patch' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  }
})

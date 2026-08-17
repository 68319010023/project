import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'
import { useAuth } from './composables/useAuth'

const app = createApp(App)

app.directive('reveal', {
  mounted(el) {
    el.classList.add('reveal')
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.15 })
    observer.observe(el)
  },
})

const { initAuth } = useAuth()

initAuth().then(() => {
  app.use(router).mount('#app')
})
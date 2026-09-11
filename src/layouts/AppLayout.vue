<script setup>
import AppNavbar from '../components/layout/AppNavbar.vue'
import AppBottomNav from '../components/layout/AppBottomNav.vue'
import { mockUser } from '../data/mockClassrooms.js'
</script>

<template>
  <div class="min-h-screen bg-gray-light">
    <AppNavbar :user="mockUser" />

    <main class="mx-auto max-w-[1200px] px-5 py-6 pb-24 md:px-10 md:py-10 md:pb-10">
      <RouterView />
    </main>

    <AppBottomNav />
  </div>
</template>

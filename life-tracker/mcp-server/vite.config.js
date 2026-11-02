import {defineConfig} from 'vite';
export default defineConfig({build:{outDir:'dist',rollupOptions:{input:{
  consent:new URL('./consent.html',import.meta.url).pathname
}}}});

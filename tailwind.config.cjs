// Used to regenerate assets/tailwind.css: npx tailwindcss@3 -c tailwind.config.cjs -i tailwind.input.css -o assets/tailwind.css --minify
module.exports = {
  content: ['./index.html', './assets/*.js'],
  theme: { extend: {
    colors: {
      sakura: {50:'#fff6fa',100:'#ffe5f0',200:'#ffc8de',300:'#ff9bc3',400:'#f476a8',500:'#e75b94',600:'#c63e79'},
      matcha: {50:'#f3f8f3',100:'#e2efe2',500:'#4e8252',600:'#3c683f'},
      matchaDark:'#2a472c', jpPaper:'#fbf9f5'
    },
    fontFamily: { sans:['Nunito','DM Sans','sans-serif'], jp:['"Noto Serif JP"','serif'] }
  } }
};

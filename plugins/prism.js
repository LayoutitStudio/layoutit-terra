import Vue from 'vue';
import Prism from 'prismjs';

Vue.directive('highlight', {
  inserted(el) {
    Prism.highlightAllUnder(el);
  },
});

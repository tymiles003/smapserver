if (Modernizr.localstorage) {
	gUserLocale = localStorage.getItem('user_locale') || navigator.language;
} else {
	console.log("local storage not supported");
	gUserLocale = navigator.language;
}

require.config({
    baseUrl: 'js/libs',
    config: {
        i18n: {
            locale: gUserLocale
        }
    },
    paths: {
    	app: '../app',
    	jquery: [
      	       '//ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min',
      	       '../../../../js/libs/jquery-1.8.3.min'
      	       ],
      	jquery_ui: [
      	       '//ajax.googleapis.com/ajax/libs/jqueryui/1.10.3/jquery-ui.min',
      	       '../../../../js/libs/jquery-ui-1.10.3.custom.min'
      	       ],
    	lang_location: '..'
    },
    shim: {
    	'foundation.min': ['jquery'],
       	'jquery_ui': ['jquery'],
    	'responsivemobilemenu': ['jquery'],
    	'app/common': ['jquery']
    }
});

require(['jquery', 'foundation.min', 'app/localise'], function($, foundation, localise) {
	$(document).foundation();
	localise.setlang();
 });

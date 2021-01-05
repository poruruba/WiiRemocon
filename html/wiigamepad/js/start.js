'use strict';

//var vConsole = new VConsole();

var vue_options = {
    el: "#top",
    data: {
        progress_title: '', // for progress-dialog

        gamepad_found: false,
        chk_btns: [],
    },
    computed: {
    },
    methods: {
    },
    created: function(){
    },
    mounted: function(){
        proc_load();
        
        setInterval(() =>{
        	var gamepadList = navigator.getGamepads();
        	var found = false;
        	for( var i = 0 ; i < gamepadList.length ; i++ ){
        		var gamepad = gamepadList[i];
        		if( gamepad ){
        		    found = true;
        			for( var j = 0 ; j < gamepad.buttons.length ; j++ ){
       					this.$set(this.chk_btns, j, gamepad.buttons[j].pressed);
        			}
        		}
        	}
        	this.gamepad_found = found;
        }, 1);
    }
};
vue_add_methods(vue_options, methods_bootstrap);
vue_add_components(vue_options, components_bootstrap);
var vue = new Vue( vue_options );

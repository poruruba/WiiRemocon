'use strict';

//var vConsole = new VConsole();

const mqtt_url = "【MQTTブローカのURL(Webソケット接続)】";
var mqtt_client = null;

const MQTT_TOPIC_CMD = 'testwii_cmd';
const MQTT_TOPIC_EVT = 'testwii_evt';

const UPDATE_INTERVAL = 200;

const NUM_OF_DATA = 50;
const NUM_OF_STICK_DATA = 3;

var timer = null;

var wii;

var acc_x, acc_y, acc_z;
var nck_evt;
var blc_evt;
var blc_temperature;

var vue_options = {
    el: "#top",
    data: {
        progress_title: '', // for progress-dialog

        mqtt_url: mqtt_url,
        update_interval: UPDATE_INTERVAL,
        chk_btns: [],
        chk_nck_btns: [],
        battery: 0,
        wii_type: "remocon",
        btaddress: "",
        battery: 0,
        reporting_mode: WIIREMOTE_REPORTID_BTNS,
        flags: [],
        remote_address: "",
        blc_calibration: null,
        blc_battery: false,
        blc_total_weight: 0,
        connected: false,
        leds : [],
        rumble: false,
    },
    computed: {
    },
    methods: {
        change_rumble_led: function(){
            if(!this.connected)
                return;
            var value = 0;
            if( this.leds[0] ) value |= WIIREMOTE_LED_BIT0;
            if( this.leds[1] ) value |= WIIREMOTE_LED_BIT1;
            if( this.leds[2] ) value |= WIIREMOTE_LED_BIT2;
            if( this.leds[3] ) value |= WIIREMOTE_LED_BIT3;
            if( this.rumble ) value |= WIIREMOTE_RUMBLE_MASK;

            var data = [WIIREMOTE_REPORTID_LED, value ];
            wii.writaValue(data);
        },
        change_reporting_mode: function(){
            var data = [WIIREMOTE_REPORTID_REPORTINGMODE, 0x00, this.reporting_mode ];
            wii.writaValue(data);
        },
        stop_graph: function(){
            if( timer != null ){
                clearTimeout(timer);
                timer = null;
            }
        },
        init_graph: function(){
            if( timer != null ){
                clearTimeout(timer);
                timer = null;
            }

            var labels = [];
            for( var i = 0 ; i < NUM_OF_DATA ; i++ )
                labels.push( -(NUM_OF_DATA - i - 1) * UPDATE_INTERVAL );

            for( var i = 0 ; i < myChart_acc.data.datasets.length ; i++ ){
                myChart_acc.data.datasets[i].data = [];
                for( var j = 0 ; j < NUM_OF_DATA ; j++ )
                    myChart_acc.data.datasets[i].data.push(NaN);
            }
            myChart_acc.data.labels = labels;

            for( var i = 0 ; i < myChart_nck_acc.data.datasets.length ; i++ ){
                myChart_nck_acc.data.datasets[i].data = [];
                for( var j = 0 ; j < NUM_OF_DATA ; j++ )
                    myChart_nck_acc.data.datasets[i].data.push(NaN);
            }
            myChart_nck_acc.data.labels = labels;

            for( var i = 0 ; i < myChart_nck_stk.data.datasets.length ; i++ ){
                myChart_nck_stk.data.datasets[i].data = [];
                for( var j = 0 ; j < NUM_OF_STICK_DATA ; j++ )
                    myChart_nck_stk.data.datasets[i].data.push(NaN);
            }

            timer = setInterval(() =>{
                this.update_graph();
            }, this.update_interval);
        },
        async update_graph(){
            myChart_acc.data.datasets[0].data.push(acc_x);
            myChart_acc.data.datasets[1].data.push(acc_y);
            myChart_acc.data.datasets[2].data.push(acc_z);
            myChart_acc.data.datasets[0].data.shift();
            myChart_acc.data.datasets[1].data.shift();
            myChart_acc.data.datasets[2].data.shift();
            myChart_acc.update();

            if( nck_evt ){
                myChart_nck_acc.data.datasets[0].data.push(nck_evt.acc_x);
                myChart_nck_acc.data.datasets[1].data.push(nck_evt.acc_y);
                myChart_nck_acc.data.datasets[2].data.push(nck_evt.acc_z);
                myChart_nck_acc.data.datasets[0].data.shift();
                myChart_nck_acc.data.datasets[1].data.shift();
                myChart_nck_acc.data.datasets[2].data.shift();
                myChart_nck_acc.update();

                myChart_nck_stk.data.datasets[0].data.push({ x: nck_evt.stk_x, y: nck_evt.stk_y });
                myChart_nck_stk.data.datasets[0].data.shift();
                myChart_nck_stk.update();
            }

            if( this.blc_calibration && blc_evt ){
                var weight = wii.calcurateBalanceBoard(blc_evt, this.blc_calibration);
                myChart_blc.data.datasets[0].data[0] = weight.topright;
                myChart_blc.data.datasets[1].data[0] = weight.bottomright;
                myChart_blc.data.datasets[2].data[0] = weight.topleft;
                myChart_blc.data.datasets[3].data[0] = weight.bottomleft;
                this.blc_total_weight = weight.total_weight;
                myChart_blc.update();
            }
        },
        mqtt_onMessagearrived: async function(message){
            try{
                var topic = message.destinationName;
                if( topic == MQTT_TOPIC_EVT){
                    var msg = JSON.parse(message.payloadString);
                    console.log(msg);
                    if( msg.rsp == WIIREMOTE_CMD_EVT){
                        var event = wii.parseReporting(msg.evt);
                        if(event.btns != undefined){
                            for( var i = 0 ; i < 16 ; i++ )
                                this.$set(this.chk_btns, i, (event.btns & (0x0001 << i)) != 0);
                        }
                        if(event.acc_x != undefined) acc_x = event.acc_x;
                        if(event.acc_y != undefined) acc_y = event.acc_y;
                        if(event.acc_z != undefined) acc_z = event.acc_z;
                        if(event.battery != undefined) this.battery = event.battery;
                        if(event.flags != undefined){
                            this.flags[0] = ( event.flags & WIIREMOTE_FLAG_BIT_BATTERY_EMPTY ) ? true : false;     
                            this.flags[1] = ( event.flags & WIIREMOTE_FLAG_BIT_EXTENSION_CONNECTED ) ? true : false;     
                            this.flags[2] = ( event.flags & WIIREMOTE_FLAG_BIT_SPEAKER_ENABLED ) ? true : false;     
                            this.flags[3] = ( event.flags & WIIREMOTE_FLAG_BIT_IR_ENABLED ) ? true : false;     
                        }
                        if(event.report_id == WIIREMOTE_REPORTID_BTNS_EXT8 || event.report_id == WIIREMOTE_REPORTID_BTNS_EXT19 ||
                            event.report_id == WIIREMOTE_REPORTID_BTNS_ACC_EXT16 || event.report_id == WIIREMOTE_REPORTID_BTNS_IR10_EXT9 ||
                            event.report_id == WIIREMOTE_REPORTID_BTNS_ACC_IR10_EXT6 || event.report_id == WIIREMOTE_REPORTID_EXT21)
                        {
                            if( this.wii_type == "remocon"){
                                nck_evt = wii.parseExtension(WIIREMOTE_EXT_TYPE_NUNCHUCK, event.extension);
                                for( var i = 0 ; i < 2 ; i++ )
                                    this.$set(this.chk_nck_btns, i, (nck_evt.btns & (0x0001 << i)) != 0);
                            }else if( this.wii_type = "balance"){
                                blc_evt = wii.parseExtension(WIIREMOTE_EXT_TYPE_BALANCEBOARD, event.extension);
                                if( blc_evt.temperature != undefined) blc_temperature = blc_evt.temperature;
                                if( blc_evt.battery != undefined) this.blc_battery = blc_evt.battery;
                            }
                        }
                    }else
                    if( msg.rsp == WIIREMOTE_CMD_REQ_STATUS){
                        var event = wii.parseReporting(msg.status);
                        console.log(event);
                        if(event.btns != undefined){
                            for( var i = 0 ; i < 16 ; i++ )
                                this.$set(this.chk_btns, i, (event.btns & (0x0001 << i)) != 0);
                        }
                        if(event.acc_x != undefined) acc_x = event.acc_x;
                        if(event.acc_y != undefined) acc_y = event.acc_y;
                        if(event.acc_z != undefined) acc_z = event.acc_z;
                        if(event.battery != undefined) this.battery = event.battery;
                        if(event.flags != undefined){
                            this.flags[0] = ( event.flags & WIIREMOTE_FLAG_BIT_BATTERY_EMPTY ) ? true : false;     
                            this.flags[1] = ( event.flags & WIIREMOTE_FLAG_BIT_EXTENSION_CONNECTED ) ? true : false;     
                            this.flags[2] = ( event.flags & WIIREMOTE_FLAG_BIT_SPEAKER_ENABLED ) ? true : false;     
                            this.flags[3] = ( event.flags & WIIREMOTE_FLAG_BIT_IR_ENABLED ) ? true : false;     
                        }
                    }else
                    if( msg.rsp == WIIREMOTE_CMD_READ_REG_LONG){
                        if( msg.offset == WIIREMOTE_ADDRESS_BALANCE_CALIBRATION){
                            this.blc_calibration = wii.parseBalanceBoardCalibration(msg.value);
                            console.log(this.blc_calibration);
                        }

                    }else
                    if( msg.rsp == WIIREMOTE_CMD_REQ_REMOTE_ADDRESS){
                        if(msg.address)
                            this.remote_address = wii.addr2str(msg.address);
                        else
                            this.remote_address = "";
                    }else if( msg.rsp == WIIREMOTE_CMD_ERR ){
                        console.error("WIIREMOTE_CMD_ERR: " + msg.error);
                    }else{
                        throw 'unknown rsp';
                    }
                }else{
                    console.error('Unknown topic');
                }
            }catch(error){
                console.error(error);
            }
        },
        mqtt_onConnectionLost: function(errorCode, errorMessage){
            console.log("MQTT.onConnectionLost", errorCode, errorMessage);
            this.connected = false;
            this.stop_graph();
        },
        mqtt_onConnect: async function(){
            console.log("MQTT.onConnect");
            this.connected = true;

            wii = new WiiClient(mqtt_client, MQTT_TOPIC_CMD);
            this.init_graph();
            mqtt_client.subscribe(MQTT_TOPIC_EVT);
        },
        connect_wii: function(){
            if(!this.connected)
                return;
            wii.connect(this.btaddress);
        },
        disconnect_wii: function(){
            wii.disconnect();
        },
        request_status: function(){
            if(!this.connected)
                return;
            wii.requestStatus();
            wii.requestRemoteAddress();
        },
        enable_extension: function(){
            if(!this.connected)
                return;
            wii.enableExtension(true);
        },
        update_calibration: function(){
            if(!this.connected)
                return;
            wii.readRegisterLong(WIIREMOTE_ADDRESS_BALANCE_CALIBRATION, 0x20);
        },
        connect_mqtt: async function(){
            mqtt_client = new Paho.MQTT.Client(this.mqtt_url, "browser");
            mqtt_client.onMessageArrived = this.mqtt_onMessagearrived;
            mqtt_client.onConnectionLost = this.mqtt_onConnectionLost;

            mqtt_client.connect({
                onSuccess: this.mqtt_onConnect
            });
        },
    },
    created: function(){
    },
    mounted: function(){
        proc_load();
    }
};
vue_add_methods(vue_options, methods_bootstrap);
vue_add_components(vue_options, components_bootstrap);
var vue = new Vue( vue_options );

var myChart_acc = new Chart( $('#chart_acc')[0].getContext('2d'), {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: "acc_x",
            fill: false,
            data: []
        },{
            label: "acc_y",
            fill: false,
            data: []
        }, {
            label: "acc_z",
            fill: false,
            data: []
        }]
    },
    options: {
        animation: false,
        scales: {
            yAxes: [{
                ticks: {
                    suggestedMax: 255 * 4,
                    suggestedMin: 0,
                }
            }]
        },
        plugins: {
            colorschemes: {
                scheme: 'brewer.Paired12'
            },
        }
    }
});
var myChart_nck_acc = new Chart( $('#chart_nck_acc')[0].getContext('2d'), {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: "acc_x",
            fill: false,
            data: []
        },{
            label: "acc_y",
            fill: false,
            data: []
        }, {
            label: "acc_z",
            fill: false,
            data: []
        }]
    },
    options: {
        animation: false,
        scales: {
            yAxes: [{
                ticks: {
                    suggestedMax: 255 * 4,
                    suggestedMin: 0,
                }
            }]
        },
        plugins: {
            colorschemes: {
                scheme: 'brewer.Paired12'
            },
        }
    }
});
var myChart_nck_stk = new Chart( $('#chart_nck_stk')[0].getContext('2d'), {
    type: 'scatter',
    data: {
        labels: ["nck_stk"],
        datasets: [{
            label: "stick",
            data: []
        }]
    },
    options: {
        scales: {
            xAxes: [{
                ticks: {
                    suggestedMax: 255,
                    suggestedMin: 0,
                }
            }],
            yAxes: [{
                ticks: {
                    suggestedMax: 255,
                    suggestedMin: 0,
                }
            }]
        },
        plugins: {
            colorschemes: {
                scheme: 'brewer.RdYlBu11'
            },
        }
    }
});
var myChart_blc = new Chart( $('#chart_blc')[0].getContext('2d'), {
    type: 'bar',
    data: {
        labels: [],
        datasets: [{
            label: "top_right",
            data: []
        },{
            label: "bottom_right",
            data: []
        },{
            label: "top_left",
            data: []
        }, {
            label: "bottom_left",
            data: []
        }]
    },
    options: {
        animation: false,
        scales: {
            yAxes: [{
                ticks: {
                    suggestedMax: 34,
                    suggestedMin: 0,
                }
            }]
        },
        plugins: {
            colorschemes: {
                scheme: 'brewer.Paired12'
            },
        }
    }
});

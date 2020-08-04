 {
   "targets": [
     {
       "target_name": "binding",
       "sources": ["src/BtL2capHid.cpp"],
      'link_settings': {
        'libraries': [
          '-lbluetooth',
        ],
      },
      "include_dirs": ["<!(node -e \"require('nan')\")"]
     }
   ]
 }
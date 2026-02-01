{
  "targets": [
    {
      "target_name": "ece_native",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "sources": [
        "./src/native/main.cpp",
        "./src/native/key_assassin.cpp",
        "./src/native/atomizer.cpp",
        "./src/native/fingerprint.cpp",
        "./src/native/html_ingestor.cpp",
        "./src/native/agent/tool_executor.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "<!@(echo $SDKROOT)/usr/include/c++/v1"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ["OS=='win'", {
          "variables": {
            # Check if we have RE2 installed - simplified approach
            "have_re2%": "0"  # Default to 0 on Windows, assuming RE2 is not installed
          },
          "conditions": [
            ["have_re2==1", {
              "defines": [ "USE_RE2" ],
              "libraries": [ "-lre2" ]
            }]
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 0,
              "AdditionalOptions": ["/std:c++17"]
            }
          }
        }],
        ["OS=='linux'", {
          "variables": {
            "have_re2%": "<!(sh -c \"pkg-config --exists re2 2>/dev/null && echo 1 || echo 0\")"
          },
          "conditions": [
            ["have_re2==1", {
              "defines": [ "USE_RE2" ],
              "libraries": [ "-lre2" ],
              "cflags_cc": [ "-std=c++17", "-O3" ],
              "cflags": [ "-O3" ]
            }]
          ]
        }],
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "NO",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.15",
            "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
            "SDKROOT": "macosx",
            "OTHER_CPLUSPLUSFLAGS": [
              "-std=c++17",
              "-stdlib=libc++",
              "-O3"
            ],
            "OTHER_LDFLAGS": [
              "-stdlib=libc++"
            ]
          },
          "cflags_cc": ["-std=c++17", "-stdlib=libc++", "-O3"],
          "ldflags": ["-stdlib=libc++"]
        }]
      ],
      "target_conditions": [
        ["OS in ['linux', 'freebsd', 'openbsd', 'solaris']", {
          "cflags+": ['-msse4.2', '-mpopcnt'],
          "ldflags+": ['-msse4.2', '-mpopcnt']
        }],
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "EnableEnhancedInstructionSet": 2 # AVX2
            }
          }
        }]
      ]
    }
  ]
}
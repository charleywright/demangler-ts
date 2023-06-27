# demangler-ts (UNDER DEVELOPMENT)
A TypeScript implementation of C++ name mangling, following the [Itanium ABI](https://itanium-cxx-abi.github.io/cxx-abi/abi.html#mangling).  

This was mainly written for use with [Frida](https://frida.re) on Android. I've tried to provide test cases covering weird edge-cases as well as normal usage however they are likely inomplete. Any contributions should be done through PR's, and if fixing a bug should provide test cases for that bug. All code is licensed under ISC for simplicity.


### References and useful projects
[https://itanium-cxx-abi.github.io/cxx-abi/abi.html#mangling](https://itanium-cxx-abi.github.io/cxx-abi/abi.html#mangling)  
[https://github.com/gchatelet/gcc_cpp_mangling_documentation](https://github.com/gchatelet/gcc_cpp_mangling_documentation)  
[https://github.com/travitch/itanium-abi](https://github.com/travitch/itanium-abi)  

# simple-node-server

A simple fast node http server.  More a toolkit than a platform.

So far:

* File Serving
* Auto indexing
* Directory indexing

Next:

* Configurable logging statements (dumping everything now, it's perty noisy)
* More eventedness/AOP/etc. A way for plugins to alter the behavior of the server, without necessarily
  being one of the servlets in the chain
* ejs and markdown parsers
* some scripts to wrap up the core server, and do stuff like start, stop, point &2 at a log file, etc.
* url-to-function routing goodness

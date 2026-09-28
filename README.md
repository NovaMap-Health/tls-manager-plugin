# TLS Manager Plugin for Open Integration Engine

# Introduction

This TLS Manager Plugin for OIE has been sponsored by [NovaMap Health Limited](https://www.novamap.health/) (UK) and [Diridium Technologies Inc.](https://diridium.com/) (USA) and donated to the Open Integration Engine initiative. Copyright is retained by NovaMap Health Limited but is licensed under MPL 2.0.

The objective was to implement security features for OIE which were felt to be missing from what we would argue are necessary to consider OIE as a minimum viable product.

# Functionality

The plugin adds significant additional TLS functionality to both the Senders and Listeners for the HTTP, Web Service and TCP Connectors, including:

* mTLS (for both senders and listeners)  
* CRL and OSCP (including strict fail)  
* Subject DN validation  
* Hostname validation  
* Selection of permitted cipher suites  
* Selection of permitted TLS versions  
* TCP Connectors can operate in client or server mode  
* A connection testing facility.

In addition, the following global features have been implemented:

* View list of trusted certificates in the OIE truststore  
* View list of certificates in the Java default trust store  
* View local key pairs  
* Import trusted root and intermediate signing certs from PEM format file  
* Import trusted root and intermediate signing certs in PEM format from URL  
* Import key pairs in PEM format from file.  
* View certificate details  
* Edit certificate alias  
* Remove trusted certificate  
* Remove local key pairs

Channel scripts can also call bundled `TLSManager.httpGet`, `httpPost`, `httpPut`,
`httpPatch`, `httpDelete`, `httpHead`, and `httpOptions` helpers directly. HTTPS
uses managed trust, with optional explicit managed client-certificate selection
for mTLS. See the [HTTP helper reference](docs/http-helpers.md).

# Installation notes

We will be distributing the plugin as a ZIP file for importing in the usual manner. It will be signed by NovaMap Health Limited using a code signing cert issued by a common CA. [Here](https://github.com/ssrowe/docs-website/blob/docs/plugin-guide/docs/engine/plugins.md) is an excellent guide written by Sean Rowe on installing plugins into OIE.

A minimum of Java 17 is required for both OIE and the Launcher.

Once the plugin is installed, you will see additional options in the Connectors listed above, plus you will be able to access the web-based Certificate Manager at *\[base URL\]/tls-manager*, which most commonly is [*https://localhost:8443/tls-manager*](https://localhost:8443/tls-manager)

As already mentioned, there are some environment variables that can be tweaked, however they have sensible defaults so that plugin will work out-of-the-box. The default persistence mechanism for the keystore is the OIE DB.

The user guide can be downloaded from the [NovaMap Health website](https://www.novamap.health/products/open-integration-engine).

# Known issues and limitations

Over the course of the project identified a few features that we have taken note of but decided are not necessary for an MVP and so can be picked up at a later date. Our intention is to record these in GitHub soon.   
There are a small number of known issues which aren’t substantial enough to warrant delaying the release, but are significant enough to make you aware of. They have been recorded in the GitHub Issues page.

# Architectural and Other Non-Functional Requirements

We set the following architectural and non-functional requirements for the project:

* From the user’s perspective, they will see the existing HTTP/TCP/WebService Connectors replaced by TLS-capable connectors.  
* Existing channels that use the current non-TLS connectors should continue to function once the new TLS Manager plugin has been installed.  
* All certs, keys, aliases, configuration settings, and TLS policies must be stored in the native mirthdb. Note that there is an option, configurable via environment variables, to use keystores in file-based storage.  
* All reading and writing of settings, whether global or channel-related should be performed via the API.  
* The global settings should be available as a web page.  
* The global settings manager should be in static JS form so that it can be served by any web server, but it will be packaged with the plugin so that each OIE instance can be self-contained.  
* It will be necessary for the user to authenticate themselves using OIE’s existing stored credentials before being able to access the global settings.  
* Certificates are associated with channels by their alias.  
* Although only tested with OIE 4.5.2, nothing should prevent the plugin from working with other compatible products that implement the same API.

# Testing Regime

### We have developed and tested it against the current main branch of OIE 4.5.2. 

The testing regime took on a life of its own in this project\! The UX testing was relatively straightforward, but verifying the correct operation of all the functionality across all 6 senders and receivers, including mocking CRL and OSCP endpoints was much more than we had anticipated; there are now over 400 integration test cases that have been written to ensure correct operation. Indeed the creation of the automated integration test framework (using K8s, Caddy, Zephyr and JIRA) became a significant engineering project in its own right, but we took the view that it was important to invest now in order to reduce maintenance effort down the line and also to demonstrate that we take quality and security exceptionally importantly.

In addition, we have performed some backward compatibility testing that is focused on ensuring that installing the TLS Manager Plugin doesn’t affect existing channels, and also some load testing to ensure that we haven’t done anything to break the multi-threading or to introduce significant latency.

# The use of the Web UI \- A project for the future

It was an easy decision for us to decide to implement the Certificate Manager using a web UI rather than within the existing Administration Console, but it raised some bigger architectural issues that we had to park for now. These issues included:

* What tech stack to use  
* The creation of an overarching UI container into which new plugins could add their web UIs  
* How to accommodate multi-OIE instance management tools whilst ensuring that each OIE instance can operate in a completely self-contained manner.

We already have some thoughts on the above, and we are aware that other contributors are also champing at the bit, so we would like to propose the creation of a small sub-project group (maybe focusing specifically on the framework for Plugin Web UIs) to take this forward.

# What happens next

From this point we consider the code to be a community asset and hence, responsibility, but of course will be happy to contribute to the maintenance, including the continued provision of NovaMap’s integration test suite, and in particular assisting with any rapid responses required to address any security vulnerabilities identified.

# Acknowledgements

The core team members involved:

* Alex Frîncu  
* Andreea Dincă  
* Andrei Haiducu  
* Ed Riordan  
* Kaur Palang  
* Paul Coyne  
* Paul Hristea  
* Paul Richardson

Many thanks to all the above for their hard work, dedication and professionalism.

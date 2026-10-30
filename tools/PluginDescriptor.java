/* SPDX-License-Identifier: MPL-2.0 */
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.jar.JarFile;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/** Build-time descriptor extension; run with the JDK source launcher (Java 17+). */
public final class PluginDescriptor {
    private static final String USERUTIL = "Packages.org.openintegrationengine.tlsmanager.userutil";
    private static final String FACADE = "org/openintegrationengine/tlsmanager/userutil/TLSManager.class";

    public static void main(String[] args) throws Exception {
        if (args.length != 2 || !(args[0].equals("register") || args[0].equals("verify"))) {
            throw new IllegalArgumentException("Usage: PluginDescriptor.java register plugin.xml | verify extension-directory");
        }
        if (args[0].equals("register")) {
            register(Path.of(args[1]));
        } else {
            verify(Path.of(args[1]));
        }
    }

    private static Document read(Path path) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        Document document = factory.newDocumentBuilder().parse(path.toFile());
        if (!document.getDocumentElement().getTagName().equals("pluginMetaData")) {
            throw new IllegalArgumentException("Expected pluginMetaData descriptor: " + path);
        }
        return document;
    }

    private static void register(Path descriptor) throws Exception {
        Document document = read(descriptor);
        NodeList lists = document.getDocumentElement().getElementsByTagName("userutilPackages");
        if (lists.getLength() > 1) {
            throw new IllegalArgumentException("Duplicate userutilPackages elements");
        }
        Element packages;
        if (lists.getLength() == 0) {
            packages = document.createElement("userutilPackages");
            document.getDocumentElement().appendChild(packages);
        } else {
            packages = (Element) lists.item(0);
        }
        NodeList entries = packages.getElementsByTagName("string");
        for (int i = 0; i < entries.getLength(); i++) {
            if (USERUTIL.equals(entries.item(i).getTextContent().trim())) {
                return;
            }
        }
        Element entry = document.createElement("string");
        entry.setTextContent(USERUTIL);
        packages.appendChild(entry);
        TransformerFactory factory = TransformerFactory.newInstance();
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_STYLESHEET, "");
        var transformer = factory.newTransformer();
        transformer.setOutputProperty(OutputKeys.INDENT, "yes");
        transformer.transform(new DOMSource(document), new StreamResult(descriptor.toFile()));
    }

    private static void verify(Path extension) throws Exception {
        Document document = read(extension.resolve("plugin.xml"));
        int registrations = 0;
        NodeList packages = document.getDocumentElement().getElementsByTagName("userutilPackages");
        if (packages.getLength() != 1) {
            throw new IllegalStateException("Expected exactly one userutilPackages element");
        }
        NodeList entries = ((Element) packages.item(0)).getElementsByTagName("string");
        for (int i = 0; i < entries.getLength(); i++) {
            if (USERUTIL.equals(entries.item(i).getTextContent().trim())) {
                registrations++;
            }
        }
        if (registrations != 1) {
            throw new IllegalStateException("Expected exactly one TLSManager userutil registration");
        }
        boolean facadeVisible = false;
        NodeList libraries = document.getDocumentElement().getElementsByTagName("library");
        for (int i = 0; i < libraries.getLength(); i++) {
            Element library = (Element) libraries.item(i);
            Path path = extension.resolve(library.getAttribute("path")).normalize();
            if (!path.startsWith(extension.normalize()) || !Files.isRegularFile(path)) {
                throw new IllegalStateException("Missing or invalid extension library: " + path);
            }
            try (JarFile jar = new JarFile(path.toFile())) {
                if (jar.stream().anyMatch(entry -> entry.getName().startsWith("org/mozilla/javascript/")
                        || entry.getName().startsWith("com/mirth/connect/"))) {
                    throw new IllegalStateException("Engine or Rhino classes must not be bundled: " + path);
                }
                if (jar.getJarEntry(FACADE) != null) {
                    String type = library.getAttribute("type");
                    facadeVisible |= type.equalsIgnoreCase("SERVER") || type.equalsIgnoreCase("SHARED");
                }
            }
        }
        if (!facadeVisible) {
            throw new IllegalStateException("TLSManager facade is missing from a SERVER/SHARED library");
        }
        System.out.println("Verified TLSManager package registration, server class visibility, and packaged libraries");
    }
}

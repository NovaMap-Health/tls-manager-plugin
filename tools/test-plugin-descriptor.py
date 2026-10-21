#!/usr/bin/env python3
"""Regression checks for the generated descriptor's registration and classpath gate."""
import pathlib
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zipfile

TOOL = pathlib.Path(__file__).with_name("PluginDescriptor.java").resolve()
PACKAGE = "Packages.org.openintegrationengine.tlsmanager.userutil"
FACADE = "org/openintegrationengine/tlsmanager/userutil/TLSManager.class"


class DescriptorTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="tls-descriptor-test-")
        self.addCleanup(self.temp.cleanup)
        self.extension = pathlib.Path(self.temp.name)
        self.descriptor = self.extension / "plugin.xml"

    def run_tool(self, action, expected=0):
        result = subprocess.run(["java", str(TOOL), action,
                                 str(self.descriptor if action == "register" else self.extension)],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)

    def write_descriptor(self, packages="", library_type="SERVER"):
        self.descriptor.write_text(
            '<pluginMetaData path="tls-manager"><name>TLS Manager</name>'
            '<serverClasses><string>existing.Service</string></serverClasses>'
            f'<library path="tlsmanager-server.jar" type="{library_type}"/>'
            f'{packages}</pluginMetaData>')

    def write_jar(self, entries):
        with zipfile.ZipFile(self.extension / "tlsmanager-server.jar", "w") as jar:
            for entry in entries:
                jar.writestr(entry, b"fixture")

    def test_preserves_metadata_and_existing_packages_without_duplicates(self):
        self.write_descriptor('<userutilPackages><string>Packages.existing.userutil</string></userutilPackages>')
        self.run_tool("register")
        once = self.descriptor.read_bytes()
        self.run_tool("register")
        self.assertEqual(self.descriptor.read_bytes(), once)
        root = ET.fromstring(once)
        self.assertEqual([x.text for x in root.findall("userutilPackages/string")],
                         ["Packages.existing.userutil", PACKAGE])
        self.assertEqual(root.findtext("serverClasses/string"), "existing.Service")
        self.assertEqual(root.attrib["path"], "tls-manager")

    def test_registration_and_server_library_are_both_required(self):
        self.write_descriptor()
        self.write_jar([FACADE])
        self.run_tool("verify", 1)
        self.run_tool("register")
        self.run_tool("verify")
        self.write_jar(["unrelated/Service.class"])
        self.run_tool("verify", 1)

    def test_client_only_facade_and_engine_shadow_classes_are_rejected(self):
        self.write_descriptor(library_type="CLIENT")
        self.run_tool("register")
        self.write_jar([FACADE])
        self.run_tool("verify", 1)
        self.write_descriptor()
        self.run_tool("register")
        self.write_jar([FACADE, "org/mozilla/javascript/Context.class"])
        self.run_tool("verify", 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)

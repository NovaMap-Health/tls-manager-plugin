#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2024 Kaur Palang
# Copyright (c) 2026 NovaMap Health Limited <https://novamap.health>

function buildPlugin() {

  echo "########################################"
  echo
  echo "   mvn cleaning..."
  echo
  echo "########################################"
  mvn clean

  echo "########################################"
  echo
  echo "   Building jars..."
  echo
  echo "########################################"
  shortHash=$(git rev-parse --short HEAD)
  mvn install package -DskipTests -Dgit.hash="$shortHash"

  PLUGIN_PATH=$(mvn exec:exec --non-recursive --quiet -Dexec.executable="echo" -Dexec.args='${mirth.plugin.path}')
  ARTIFACT_ID=$(mvn exec:exec --non-recursive --quiet -Dexec.executable="echo" -Dexec.args='${project.artifactId}')

  echo "########################################"
  echo
  echo "   Copying libraries..."
  echo
  echo "########################################"
  mkdir -p "$STAGING_DIR/libs"

  modules=("server" "client" "shared")
  for module in "${modules[@]}"; do
    if find "libs/runtime/$module/" -maxdepth 1 -iname "*.jar" | grep -q .; then
      cp libs/runtime/"$module"/*.jar "$STAGING_DIR/libs/"
    else
      echo "No .jar files in libs/runtime/$module/"
    fi
  done

  echo "########################################"
  echo
  echo "   Generating plugin.xml..."
  echo
  echo "########################################"
  mvn -N com.kaurpalang:mirth-plugin-maven-plugin:3.0.0:generate-plugin-xml -Dgit.hash="$shortHash"

  # The upstream descriptor generator has no userutilPackages input. Extend its
  # output from this checked-in build input, preserving all generated metadata.
  java tools/PluginDescriptor.java register plugin.xml

  mv plugin.xml "$STAGING_DIR"

  echo "########################################"
  echo
  echo "   Copying Web Administrator plugin..."
  echo
  echo "########################################"
  # Shipped inside the extension zip as <extension>/webadmin/ — the web
  # administrator's plugin loader discovers it when its plugin search path
  # includes the engine's extensions directory. Copied verbatim (no token
  # filtering) so any ${...} strings in plugin.js survive.
  #
  # Ship only the runtime plugin (plugin.json + the built web/plugin.js);
  # exclude the React source + esbuild build tooling (the frontend-maven-plugin
  # generate-resources step built web/plugin.js during `mvn ... package` above).
  rsync -a \
    --exclude 'node_modules/' \
    --exclude 'package.json' \
    --exclude 'package-lock.json' \
    --exclude '.gitignore' \
    --exclude 'build.mjs' \
    --exclude 'tests/' \
    --exclude 'web/plugin.jsx' \
    webadmin/ "$STAGING_DIR/webadmin/"

  echo "########################################"
  echo
  echo "   Packaging plugin..."
  echo
  echo "########################################"
  cp {client,server,shared}/target/*.jar "$STAGING_DIR/"
  java tools/PluginDescriptor.java verify "$STAGING_DIR"
}

function buildWebUi() {
  pushd web-ui

  rm -rf tls-manager/

  npm i
  npm run build

  mkdir tls-manager/WEB-INF
  cp static/web.xml tls-manager/WEB-INF/

  jar -cvf tls-manager.war -C tls-manager .

  cp tls-manager.war ../"$STAGING_DIR"

  popd
}

function package() {
  pushd target
  mv staging "$PLUGIN_PATH"
  zip -r "$PLUGIN_PATH-$shortHash" "$PLUGIN_PATH"
  popd
}

set -euxo pipefail

STAGING_DIR=target/staging

buildPlugin
buildWebUi
package

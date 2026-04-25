{
  description = "Beautiful, interactive CoNLL-U dependency tree visualizer";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

      in
      {
        packages.default = pkgs.buildNpmPackage {
          pname = "conllu-viz";
          version = "0.1.0";

          src = self;

          npmDepsHash = "sha256-Yr/NMA0eB9DV9p/LU3Uk9nRgROfRhBcpcwp972JoaiU=";

          # Native deps for better-sqlite3
          nativeBuildInputs = with pkgs; [
            python3
            pkg-config
          ];

          buildInputs = with pkgs; [
            gcc
            gnumake
            sqlite
          ];

          installPhase = ''
            runHook preInstall
            cp -r dist $out
            runHook postInstall
          '';
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            python3
            pkg-config
            gcc
            gnumake
            sqlite
          ];

          shellHook = ''
            export npm_config_nodedir=${pkgs.nodejs_22}
          '';
        };
      }
    );
}

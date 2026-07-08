{
  description = "Narval development environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            # Go backend
            go_1_25
            golangci-lint
            air                # hot reload (make dev-api)
            # oapi-codegen runs via `go run` (pinned by go.mod), not from PATH

            # Web frontend
            nodejs_22
            redocly            # OpenAPI bundling (make generate)

            # CI / tooling
            act                # run GitHub Actions locally (make ci)
          ];

          shellHook = ''
            git config core.hooksPath .githooks
            echo "narval dev shell — go $(go version | cut -d' ' -f3), node $(node --version)"
          '';
        };
      });
}

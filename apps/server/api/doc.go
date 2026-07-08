// go run pins oapi-codegen to the version in go.mod, so local and CI output
// (including the embedded version string) are byte-identical.
//go:generate go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen -config oapi-codegen.yaml openapi.bundled.yaml

package api

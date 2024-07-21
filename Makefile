BIN_NAME=kulala-fmt

build-windows-64:
	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags "-s -w -X 'github.com/mistweaverco/kulala-fmt/cmd/kulalafmt.VERSION=$(VERSION)'" -o dist/windows/$(BIN_NAME).exe main.go
build-linux-64:
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags "-s -w -X 'github.com/mistweaverco/kulala-fmt/cmd/kulalafmt.VERSION=$(VERSION)'" -o dist/linux/$(BIN_NAME)-linux main.go
build-macos-arm64:
	GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go build -ldflags "-s -w -X 'github.com/mistweaverco/kulala-fmt/cmd/kulalafmt.VERSION=$(VERSION)'" -o dist/macos/$(BIN_NAME)-macos main.go

builds: build-linux-64 build-macos-arm64 build-windows-64

lint:
	golangci-lint run

test:
	if [ -n $(COLORS_ENABLED) ]; then gotest ./... ; else go test ./...; fi

test-coverage:
	go test -race -covermode=atomic -coverprofile=coverage.out ./...

release:
	gh release create --generate-notes v$(VERSION) dist/linux/$(BIN_NAME)-linux dist/macos/$(BIN_NAME)-macos dist/windows/$(BIN_NAME).exe

build-and-install-local-debug:
	go build -ldflags "-X 'github.com/mistweaverco/kulala-fmt/cmd/kulalafmt.VERSION=development'" -o dist/$(BIN_NAME) main.go
	sudo mv dist/$(BIN_NAME) /usr/bin/$(BIN_NAME)

run:
	go run -ldflags "-X 'github.com/mistweaverco/kulala-fmt/cmd/kulalafmt.VERSION=development'" main.go

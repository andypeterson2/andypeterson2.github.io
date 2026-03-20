.PHONY: setup update status install clean

# One-command project setup: clone repo, run `make setup`, done.
setup:
	git submodule update --init --recursive
	@echo ""
	@echo "✓ All submodules initialised."
	@$(MAKE) --no-print-directory install

# Pull latest commits for every submodule
update:
	git submodule update --remote --merge
	@echo ""
	@echo "✓ Submodules updated to latest remote commits."

# Install npm dependencies for sub-apps that need them
install:
	@for dir in nonogram/website dashboard/website; do \
		if [ -f "$$dir/package.json" ]; then \
			echo "→ npm ci in $$dir"; \
			(cd "$$dir" && npm ci --silent); \
		fi; \
	done
	@if [ -f "lib/ui-kit/v1.1/package.json" ]; then \
		echo "→ npm ci in lib/ui-kit/v1.1"; \
		(cd lib/ui-kit/v1.1 && npm ci --silent); \
	fi
	@echo ""
	@echo "✓ Dependencies installed."

# Show submodule status at a glance
status:
	@git submodule status

# Remove all submodule working trees (re-run `make setup` to restore)
clean:
	git submodule deinit --all -f
	@echo "✓ Submodules de-initialised. Run 'make setup' to restore."

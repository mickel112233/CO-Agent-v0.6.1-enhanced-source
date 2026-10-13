# Third-party notices

CO-Agent includes or can package third-party software and assets. Their original licenses and attribution requirements remain in effect.

## AI-Desktop-Pet assets and optional companion executable

The optional desktop companion is sourced from [AI-Desktop-Pet](https://github.com/AkshitIreddy/AI-Desktop-Pet) by Akshit Ireddy. The upstream repository's root `LICENSE` is MIT; its `licenses/` directory contains additional notices for legacy assets and components, including Shimeji-ee, Kilkakon, TigerHix, John O'Conner, Yuki Yamada, and the NimROD Look And Feel project. The asset set is mixed-license; do not assume every sprite is MIT-only. The packaged app must preserve both the upstream root license and the full upstream `licenses/` directory beside the redistributed sprites.

The companion is optional. CO-Agent must report it as unavailable if its native executable or required assets are missing; it must not substitute a fake executable or silently claim it is installed.

## Other dependencies

See each dependency's package metadata and upstream license for its terms. CO-Agent's dependency manifest and build configuration identify the runtime dependencies. Distribution maintainers should re-run the dependency/license audit before publishing each release.

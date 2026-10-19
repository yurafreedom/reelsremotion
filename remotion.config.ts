import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Public dir holds timeline.json + media (clip.mp4, audio.mp3)
Config.setPublicDir("public");

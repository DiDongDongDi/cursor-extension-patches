-- Save clipboard image for Paste Image on macOS.
-- 1) Prefer pngpaste (handles TIFF screenshots; raw PNGf-only check often fails).
-- 2) Fall back to writing «class PNGf» bytes.
-- 3) Always strip color-management tags (esp. bogus gAMA≈2.2 from browser clipboard).
--    Electron/Chromium (MPE, Obsidian, etc.) honors gAMA and washes dark screenshots.
property fileTypes : {{«class PNGf», ".png"}}

on run argv
	if argv is {} then
		return ""
	end if
	
	set imagePath to (item 1 of argv)
	set saved to false
	
	set pngpasteBin to ""
	try
		set pngpasteBin to do shell script "export PATH=\"/opt/homebrew/bin:/usr/local/bin:$PATH\"; command -v pngpaste"
	end try
	
	if pngpasteBin is not "" then
		try
			do shell script (quoted form of pngpasteBin) & " " & (quoted form of imagePath)
			set saved to true
		end try
	end if
	
	if saved is false then
		set theType to getType()
		if theType is missing value then
			return "no image"
		end if
		try
			set myFile to (open for access imagePath with write permission)
			set eof myFile to 0
			write (the clipboard as (first item of theType)) to myFile
			close access myFile
			set saved to true
		on error
			try
				close access myFile
			end try
			return ""
		end try
	end if
	
	if saved is true then
		-- Drop gAMA/iCCP quirks so preview pixels match screenshot intent
		try
			do shell script "sips --deleteColorManagementProperties " & (quoted form of imagePath) & " >/dev/null 2>&1"
		end try
		return imagePath
	end if
	
	return "no image"
end run

on getType()
	repeat with aType in fileTypes
		repeat with theInfo in (clipboard info)
			if (first item of theInfo) is equal to (first item of aType) then return aType
		end repeat
	end repeat
	return missing value
end getType

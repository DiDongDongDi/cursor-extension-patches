-- Prefer pngpaste: macOS screenshots on clipboard are often TIFF, not «class PNGf».
-- Original mushan script only accepted PNGf → "There is not an image in the clipboard."
property fileTypes : {{«class PNGf», ".png"}}

on run argv
	if argv is {} then
		return ""
	end if
	
	set imagePath to (item 1 of argv)
	
	set pngpasteBin to ""
	try
		set pngpasteBin to do shell script "export PATH=\"/opt/homebrew/bin:/usr/local/bin:$PATH\"; command -v pngpaste"
	end try
	
	if pngpasteBin is not "" then
		try
			do shell script (quoted form of pngpasteBin) & " " & (quoted form of imagePath)
			return imagePath
		on error
			return "no image"
		end try
	end if
	
	set theType to getType()
	
	if theType is not missing value then
		try
			set myFile to (open for access imagePath with write permission)
			set eof myFile to 0
			write (the clipboard as (first item of theType)) to myFile
			close access myFile
			return (POSIX path of imagePath)
		on error
			try
				close access myFile
			end try
			return ""
		end try
	else
		return "no image"
	end if
end run

on getType()
	repeat with aType in fileTypes
		repeat with theInfo in (clipboard info)
			if (first item of theInfo) is equal to (first item of aType) then return aType
		end repeat
	end repeat
	return missing value
end getType

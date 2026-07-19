@echo off
setlocal enabledelayedexpansion
title Build Positioning Pro AAB
cd /d "%~dp0android"
set "LOG=%~dp0build-log.txt"

echo ===============================================
echo  Building Positioning Pro release bundle (AAB)
echo  Full log: %LOG%
echo ===============================================
echo.

if not defined JAVA_HOME (
  if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
)
if not defined JAVA_HOME (
  if exist "%LOCALAPPDATA%\Programs\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=%LOCALAPPDATA%\Programs\Android Studio\jbr"
)
if not defined JAVA_HOME (
  if exist "C:\Program Files\Android\Android Studio\jre\bin\java.exe" set "JAVA_HOME=C:\Program Files\Android\Android Studio\jre"
)
if not defined JAVA_HOME (
  echo [!] No JDK found. Open Android Studio once, then re-run. > "%LOG%"
  type "%LOG%"
  pause
  exit /b 1
)

if not exist local.properties (
  if exist "%LOCALAPPDATA%\Android\Sdk" (
    set "SDKPATH=%LOCALAPPDATA:\=/%/Android/Sdk"
    > local.properties echo sdk.dir=!SDKPATH!
  )
)

echo Building... this can take several minutes on the first run.
echo.

> "%LOG%" echo === Positioning Pro build log ===
>> "%LOG%" echo JAVA_HOME=%JAVA_HOME%
>> "%LOG%" type local.properties
>> "%LOG%" echo.
"%JAVA_HOME%\bin\java.exe" -version >> "%LOG%" 2>&1

call gradlew.bat --no-daemon --stacktrace bundleRelease >> "%LOG%" 2>&1
set "RC=%ERRORLEVEL%"

type "%LOG%"

set "OUT=%CD%\app\build\outputs\bundle\release\app-release.aab"
echo.
echo ===============================================
if exist "%OUT%" (
  echo  SUCCESS - signed AAB created:
  echo  %OUT%
) else (
  echo  BUILD FAILED ^(exit code %RC%^)
  echo  The full log was saved to:
  echo  %LOG%
  echo  Send that file to Claude.
)
echo ===============================================
echo.
pause

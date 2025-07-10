@echo off
echo Running database migrations...
mysql -u analyzer_user -ppassword website_analyzer < backend\schema.sql
if %ERRORLEVEL% EQU 0 (
    echo Migration completed successfully.
) else (
    echo Migration failed with error code %ERRORLEVEL%
)
pause 
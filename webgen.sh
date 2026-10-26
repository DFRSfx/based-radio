#!/bin/sh

TEMPLATEPAGE="./templates/page.html"

CONTENTPAGE="./content/page"
STATIC="./static"

OUTPUTDIR="./output"

mkdir -p templates content/page static
rm -rf "$OUTPUTDIR"
mkdir -p "$OUTPUTDIR"

cp -r "$STATIC"/* "$OUTPUTDIR"

sed '/{{.Content}}/ {
    r ./content/index.html
    d
}' "$TEMPLATEPAGE" > "$OUTPUTDIR/index.html"

for file in "$CONTENTPAGE"/*.html ; do
    name=$(basename -s .html "$file")
    mkdir -p "$OUTPUTDIR/$name/"
    sed '/{{.Content}}/ {
        r '"$file"'
        d
    }' "$TEMPLATEPAGE" > "$OUTPUTDIR/$name/index.html"
done


#!/usr/bin/env node
// One-time script: resize all images in Supabase Storage to max 800px wide.
// Run ONCE before go-live. Does not affect local dev or production code.
//
// Setup (run from project root):
//   npm install sharp --save-dev
//   node scripts/optimize-images.js
//
// Requires these env vars (copy from your .env.local or Vercel dashboard):
//   VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   ← use the service role key, NOT the anon key
//
// The script will:
//   1. List every file in the 'orders' storage bucket
//   2. Download each image
//   3. If it's wider than 800px, resize it (keeps aspect ratio, 82% JPEG quality)
//   4. Re-upload in place (overwrites the original)
//   5. Print a summary when done

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const SUPABASE_URL         = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET               = 'orders'
const MAX_WIDTH            = 800
const JPEG_QUALITY         = 82

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function listAllFiles(bucket) {
  const files = []
  const { data, error } = await supabase.storage.from(bucket).list('', { limit: 1000 })
  if (error) throw new Error(`List failed: ${error.message}`)

  for (const item of data || []) {
    if (item.id) {
      files.push(item.name)
    } else {
      // It's a folder — recurse one level
      const { data: nested } = await supabase.storage.from(bucket).list(item.name, { limit: 1000 })
      for (const f of nested || []) {
        if (f.id) files.push(`${item.name}/${f.name}`)
      }
    }
  }
  return files
}

async function processImage(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw new Error(`Download failed for ${path}: ${error.message}`)

  const buffer = Buffer.from(await data.arrayBuffer())
  const meta   = await sharp(buffer).metadata()

  if (!meta.width || meta.width <= MAX_WIDTH) {
    return { path, action: 'skipped', reason: `${meta.width}px — already small` }
  }

  const resized = await sharp(buffer)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer()

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, resized, { contentType: 'image/jpeg', upsert: true })

  if (uploadError) throw new Error(`Upload failed for ${path}: ${uploadError.message}`)

  const savedKb = Math.round((buffer.length - resized.length) / 1024)
  return { path, action: 'resized', originalPx: meta.width, savedKb }
}

async function run() {
  console.log(`\nConnecting to ${SUPABASE_URL}`)
  console.log(`Scanning bucket: ${BUCKET}\n`)

  const files = await listAllFiles(BUCKET)
  const images = files.filter(f => /\.(jpe?g|png|webp|gif)$/i.test(f))

  console.log(`Found ${images.length} image(s) across ${files.length} total file(s).\n`)

  let resized = 0, skipped = 0, errors = 0

  for (const path of images) {
    try {
      const result = await processImage(path)
      if (result.action === 'resized') {
        console.log(`✓ ${result.path}  ${result.originalPx}px → ${MAX_WIDTH}px  (-${result.savedKb}KB)`)
        resized++
      } else {
        console.log(`· ${result.path}  ${result.reason}`)
        skipped++
      }
    } catch (err) {
      console.error(`✗ ${path}  ${err.message}`)
      errors++
    }
  }

  console.log(`\n── Done ──`)
  console.log(`  Resized: ${resized}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Errors:  ${errors}`)
}

run().catch(err => { console.error(err); process.exit(1) })

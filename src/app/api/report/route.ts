import { put, list } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const report = await request.json();
    
    // Generate a short unique ID
    const id = crypto.randomUUID().slice(0, 8);
    const filename = `reports/${id}.json`;
    
    // Check if BLOB token is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('BLOB_READ_WRITE_TOKEN is not configured');
      return NextResponse.json(
        { error: 'Brak konfiguracji storage (BLOB_READ_WRITE_TOKEN)' },
        { status: 500 }
      );
    }
    
    // Store in Vercel Blob (needs public store)
    const blob = await put(filename, JSON.stringify(report), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
    
    return NextResponse.json({ id, url: blob.url });
  } catch (error) {
    console.error('Error saving report:', error);
    const message = error instanceof Error ? error.message : 'Nieznany błąd';
    return NextResponse.json(
      { error: `Nie udało się zapisać raportu: ${message}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Brak ID raportu' },
        { status: 400 }
      );
    }
    
    const prefix = `reports/${id}.json`;
    
    // List blobs with this prefix to find URL
    const { blobs } = await list({ prefix });
    
    if (blobs.length === 0) {
      return NextResponse.json(
        { error: 'Raport nie znaleziony' },
        { status: 404 }
      );
    }
    
    // Fetch the report data
    const response = await fetch(blobs[0].url);
    const report = await response.json();
    
    return NextResponse.json(report);
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Nie udało się pobrać raportu' },
      { status: 404 }
    );
  }
}

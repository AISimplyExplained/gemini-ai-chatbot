import { NextResponse } from 'next/server'
import { pdfToText } from 'pdf-ts'

export async function POST(request: Request) {
  try {
    const data = await request.formData()
    const pdfFile: File | null = data.get('file') as unknown as File

    if (!pdfFile) {
      return NextResponse.json(
        { error: 'Please upload a file' },
        { status: 400 }
      )
    }

    const fileBuffer = Buffer.from(await pdfFile.arrayBuffer())

    const text = await pdfToText(fileBuffer)

    return NextResponse.json({ message: 'Success', text })
  } catch (error) {
    console.log(error)
    return NextResponse.json(
      { error: 'Internal Server Error.' },
      { status: 500 }
    )
  }
}

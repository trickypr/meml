// Note that this is loosely based on the crafting interpreters book, so it will
// have a similar code structure. We are not using java because java is pain
// Maybe one day I will rewrite this in rust or maybe even c to make it work natively
// but at the moment I don't really care

import { fs } from './fs'
const { readFileSync } = fs

import { grey, red, yellow } from 'chalk'

import { Web } from './targets/Web'
import { Parser } from './parser/Parser'
import { Scanner } from './scanner/Scanner'
import { Token } from './scanner/Token'
import { TokenType } from './scanner/TokenTypes'
import { PageStmt } from './parser/Stmt'

export class MemlCore {
  static hadError = false
  static errors = ''

  // ------------------------------------------------------------
  // Interpreter stepping function

  tokenize(source: string): Token[] {
    const scanner = new Scanner(source)
    return scanner.scanTokens()
  }

  parse(tokens: Token[]): PageStmt {
    const parser = new Parser(tokens)
    return parser.parse()
  }

  targetWeb(page: PageStmt, path: string = 'memory.meml'): string {
    const target = new Web(path)
    return target.convert(page)
  }

  tokenizeAndParse(source: string): PageStmt {
    return this.parse(this.tokenize(source))
  }

  // ------------------------------------------------------------
  // Interpreter full functions

  sourceToWeb(source: string, path: string = 'memory.meml'): string {
    const tokens = this.tokenize(source)
    const parsed = this.parse(tokens)
    return this.targetWeb(parsed, path)
  }

  fileToWeb(path: string): string {
    return this.sourceToWeb(readFileSync(path).toString(), path)
  }

  // ------------------------------------------------------------
  // Error functions

  static resetErrors() {
    this.hadError = false
    this.errors = ''
  }

  static errorAtToken(token: Token, message: string): void {
    if (token.type === TokenType.EOF) {
      this.report(token.line, ' at end', message)
    } else {
      this.report(token.line, ` at '${token.lexeme}'`, message, token.context)
    }
  }

  static error(line: number, message: string) {
    this.report(line, '', message)
  }

  static linterAtToken(token: Token, message: string): void {
    this.warn(
      token.line,
      'Linter',
      ` at '${token.lexeme}'`,
      message,
      token.context
    )
  }

  static generalWarning(line: number, message: string) {
    this.warn(line, 'General', '', message)
  }

  private static report(
    line: number,
    where: string,
    message: string,
    context = ''
  ): void {
    console.error(
      red(
        `[line ${line}] Error${where}: ${message}\n${grey(
          this.formatContext(context)
        )}`
      )
    )
    this.hadError = true
    this.errors += `[line ${line}] Error${where}: ${message}\n${this.formatContext(
      context
    )}\n`
  }

  private static warn(
    line: number,
    type: 'Linter' | 'General',
    where: string,
    message: string,
    context = ''
  ): void {
    console.warn(
      yellow(
        `[line ${line}] ${type} warning${where}: ${message} \n${grey(
          this.formatContext(context)
        )}`
      )
    )

    this.errors += `[line ${line}] ${type} warning${where}: ${message} \n${this.formatContext(
      context
    )}\n`
  }

  private static formatContext(context: string): string {
    return `    ┃${context.replace(/\n/g, '\n    ┃')}`
  }
}

export class MemlC extends MemlCore {
  constructor() {
    super()
    console.error('Using MemlC is depreciated. Use the MemlCore class')
  }
}
